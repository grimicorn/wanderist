/**
 * Unit tests for server/utils/subscriptions.ts — the isolation boundary
 * between this app and Clerk Billing's webhook payload shape.
 *
 * The database is mocked so no network or database access is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSelectLimit,
  mockSelectWhere,
  mockSelectFrom,
  mockSelect,
  mockInsertOnConflictDoUpdate,
  mockInsertValues,
  mockInsert,
  mockUpdateWhere,
  mockUpdateSet,
  mockUpdate,
  mockGetDb,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn().mockResolvedValue([]);
  const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockInsertOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const mockInsertValues = vi.fn(() => ({
    onConflictDoUpdate: mockInsertOnConflictDoUpdate,
  }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

  const mockGetDb = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  }));

  return {
    mockSelectLimit,
    mockSelectWhere,
    mockSelectFrom,
    mockSelect,
    mockInsertOnConflictDoUpdate,
    mockInsertValues,
    mockInsert,
    mockUpdateWhere,
    mockUpdateSet,
    mockUpdate,
    mockGetDb,
  };
});

vi.mock("../../server/db/index", () => ({
  getDb: mockGetDb,
}));

const {
  mapClerkPlanSlug,
  mapClerkPlanPeriod,
  mapClerkSubscriptionStatus,
  getSubscriptionForUser,
  getEffectivePlan,
  upsertSubscriptionFromEvent,
  markSubscriptionItemInactive,
  recordTrialEndingSoon,
} = await import("../../server/utils/subscriptions");

function resetDbMocks() {
  mockSelectLimit.mockResolvedValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });

  mockInsertOnConflictDoUpdate.mockResolvedValue(undefined);
  mockInsertValues.mockReturnValue({
    onConflictDoUpdate: mockInsertOnConflictDoUpdate,
  });
  mockInsert.mockReturnValue({ values: mockInsertValues });

  mockUpdateWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMocks();
});

// ---------------------------------------------------------------------------
// Pure mapping helpers
// ---------------------------------------------------------------------------

describe("mapClerkPlanSlug", () => {
  it("maps 'wanderer' and 'nomad' slugs to their plan tier", () => {
    expect(mapClerkPlanSlug("wanderer")).toBe("wanderer");
    expect(mapClerkPlanSlug("nomad")).toBe("nomad");
  });

  it("returns null for an unrecognized slug", () => {
    expect(mapClerkPlanSlug("some_other_plan")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(mapClerkPlanSlug(null)).toBeNull();
    expect(mapClerkPlanSlug(undefined)).toBeNull();
  });
});

describe("mapClerkPlanPeriod", () => {
  it("maps 'month' to 'monthly'", () => {
    expect(mapClerkPlanPeriod("month")).toBe("monthly");
  });

  it("maps 'annual' to 'yearly'", () => {
    expect(mapClerkPlanPeriod("annual")).toBe("yearly");
  });

  it("returns null for anything else", () => {
    expect(mapClerkPlanPeriod("weekly")).toBeNull();
    expect(mapClerkPlanPeriod(null)).toBeNull();
  });
});

describe("mapClerkSubscriptionStatus", () => {
  it("passes through 'active' and 'past_due'", () => {
    expect(mapClerkSubscriptionStatus("active")).toBe("active");
    expect(mapClerkSubscriptionStatus("past_due")).toBe("past_due");
  });

  it("collapses every other terminal status to 'canceled'", () => {
    for (const status of [
      "canceled",
      "ended",
      "abandoned",
      "incomplete",
      "expired",
    ]) {
      expect(mapClerkSubscriptionStatus(status)).toBe("canceled");
    }
  });
});

// ---------------------------------------------------------------------------
// getSubscriptionForUser / getEffectivePlan
// ---------------------------------------------------------------------------

describe("getSubscriptionForUser", () => {
  it("returns the free Drifter plan when no row exists", async () => {
    mockSelectLimit.mockResolvedValue([]);

    const result = await getSubscriptionForUser("user-1");

    expect(result).toEqual({
      plan: "drifter",
      status: "active",
      billingCycle: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
    });
  });

  it("returns the row's plan when status is active", async () => {
    const periodEnd = new Date("2026-08-01T00:00:00.000Z");
    mockSelectLimit.mockResolvedValue([
      {
        plan: "nomad",
        status: "active",
        billingCycle: "yearly",
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      },
    ]);

    const result = await getSubscriptionForUser("user-1");

    expect(result).toEqual({
      plan: "nomad",
      status: "active",
      billingCycle: "yearly",
      trialEndsAt: null,
      currentPeriodEnd: periodEnd,
    });
  });

  it("still reports the real plan when status is past_due (for billing-management display)", async () => {
    const periodEnd = new Date("2026-08-01T00:00:00.000Z");
    mockSelectLimit.mockResolvedValue([
      {
        plan: "wanderer",
        status: "past_due",
        billingCycle: "monthly",
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      },
    ]);

    const result = await getSubscriptionForUser("user-1");

    expect(result.plan).toBe("wanderer");
    expect(result.status).toBe("past_due");
    expect(result.currentPeriodEnd).toBe(periodEnd);
  });

  it("still reports the real plan when status is canceled", async () => {
    mockSelectLimit.mockResolvedValue([
      {
        plan: "wanderer",
        status: "canceled",
        billingCycle: "monthly",
        trialEndsAt: null,
        currentPeriodEnd: null,
      },
    ]);

    const result = await getSubscriptionForUser("user-1");

    expect(result.plan).toBe("wanderer");
  });
});

describe("getEffectivePlan", () => {
  it("returns the plan tier for an active subscription", async () => {
    mockSelectLimit.mockResolvedValue([
      {
        plan: "nomad",
        status: "active",
        billingCycle: "yearly",
        trialEndsAt: null,
        currentPeriodEnd: null,
      },
    ]);

    expect(await getEffectivePlan("user-1")).toBe("nomad");
  });

  it("collapses to the free Drifter plan when status is past_due", async () => {
    mockSelectLimit.mockResolvedValue([
      {
        plan: "wanderer",
        status: "past_due",
        billingCycle: "monthly",
        trialEndsAt: null,
        currentPeriodEnd: null,
      },
    ]);

    expect(await getEffectivePlan("user-1")).toBe("drifter");
  });

  it("collapses to the free Drifter plan when status is canceled", async () => {
    mockSelectLimit.mockResolvedValue([
      {
        plan: "nomad",
        status: "canceled",
        billingCycle: "yearly",
        trialEndsAt: null,
        currentPeriodEnd: null,
      },
    ]);

    expect(await getEffectivePlan("user-1")).toBe("drifter");
  });

  it("returns the free Drifter plan when no row exists", async () => {
    mockSelectLimit.mockResolvedValue([]);
    expect(await getEffectivePlan("user-1")).toBe("drifter");
  });
});

// ---------------------------------------------------------------------------
// upsertSubscriptionFromEvent
// ---------------------------------------------------------------------------

describe("upsertSubscriptionFromEvent", () => {
  function buildPayload(overrides: Record<string, unknown> = {}) {
    return {
      id: "sub_123",
      status: "active",
      payer: { user_id: "user-1" },
      items: [
        {
          id: "si_123",
          status: "active",
          plan_period: "month" as const,
          period_end: 1785000000000,
          plan: { slug: "wanderer", period: "month" as const },
        },
      ],
      ...overrides,
    };
  }

  it("upserts the subscriptions row from a valid payload", async () => {
    await upsertSubscriptionFromEvent(buildPayload());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        plan: "wanderer",
        status: "active",
        billingCycle: "monthly",
        clerkSubscriptionId: "sub_123",
        clerkSubscriptionItemId: "si_123",
        currentPeriodEnd: new Date(1785000000000),
      }),
    );
    expect(mockInsertOnConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("no-ops when payer.user_id is missing (e.g. an org-level subscription)", async () => {
    await upsertSubscriptionFromEvent(buildPayload({ payer: {} }));
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("no-ops when there are no subscription items", async () => {
    await upsertSubscriptionFromEvent(buildPayload({ items: [] }));
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("no-ops when the plan slug isn't recognized", async () => {
    await upsertSubscriptionFromEvent(
      buildPayload({
        items: [
          {
            id: "si_123",
            status: "active",
            plan_period: "month",
            period_end: null,
            plan: { slug: "some_other_plan", period: "month" },
          },
        ],
      }),
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("stores a null currentPeriodEnd when period_end is null", async () => {
    await upsertSubscriptionFromEvent(
      buildPayload({
        items: [
          {
            id: "si_123",
            status: "active",
            plan_period: "annual",
            period_end: null,
            plan: { slug: "nomad", period: "annual" },
          },
        ],
      }),
    );

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "nomad", currentPeriodEnd: null }),
    );
  });

  it("skips a stale event for a subscription that's since been superseded", async () => {
    // The row already tracks a different (newer) subscription id — an
    // out-of-order event for the old, superseded subscription must not
    // resurrect its plan and re-grant entitlements.
    mockSelectLimit.mockResolvedValue([{ clerkSubscriptionId: "sub_newer" }]);

    await upsertSubscriptionFromEvent(buildPayload({ id: "sub_123" }));

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("proceeds when the existing row has no subscription id recorded yet (e.g. after a prior cancellation cleared it)", async () => {
    // markSubscriptionItemInactive clears clerkSubscriptionId on cancel
    // precisely so that a genuinely new subscription.created for a
    // re-subscribing user (a fresh Clerk subscription id) isn't rejected as
    // a stale/out-of-order event for the old, terminated subscription.
    mockSelectLimit.mockResolvedValue([{ clerkSubscriptionId: null }]);

    await upsertSubscriptionFromEvent(buildPayload());

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("proceeds when the existing row tracks the same subscription id", async () => {
    mockSelectLimit.mockResolvedValue([{ clerkSubscriptionId: "sub_123" }]);

    await upsertSubscriptionFromEvent(buildPayload({ id: "sub_123" }));

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// markSubscriptionItemInactive
// ---------------------------------------------------------------------------

describe("markSubscriptionItemInactive", () => {
  function buildItemPayload(overrides: Record<string, unknown> = {}) {
    return {
      id: "si_123",
      status: "canceled",
      plan_period: "month" as const,
      period_end: null,
      payer: { user_id: "user-1" },
      ...overrides,
    };
  }

  it("marks the row canceled and clears the recorded Clerk IDs when the item id matches", async () => {
    mockSelectLimit.mockResolvedValue([{ clerkSubscriptionItemId: "si_123" }]);

    await markSubscriptionItemInactive(buildItemPayload());

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith({
      status: "canceled",
      clerkSubscriptionId: null,
      clerkSubscriptionItemId: null,
    });
  });

  it("marks the row canceled when there is no row yet", async () => {
    mockSelectLimit.mockResolvedValue([]);

    await markSubscriptionItemInactive(buildItemPayload());

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("marks the row canceled when the existing row has no item id recorded", async () => {
    mockSelectLimit.mockResolvedValue([{ clerkSubscriptionItemId: null }]);

    await markSubscriptionItemInactive(buildItemPayload());

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips a stale event for an item that's since been replaced", async () => {
    mockSelectLimit.mockResolvedValue([
      { clerkSubscriptionItemId: "si_newer" },
    ]);

    await markSubscriptionItemInactive(buildItemPayload({ id: "si_123" }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("no-ops when payer.user_id is missing", async () => {
    await markSubscriptionItemInactive(buildItemPayload({ payer: {} }));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// recordTrialEndingSoon
// ---------------------------------------------------------------------------

describe("recordTrialEndingSoon", () => {
  function buildItemPayload(overrides: Record<string, unknown> = {}) {
    return {
      id: "si_123",
      status: "active",
      plan_period: "month" as const,
      period_end: 1785000000000,
      payer: { user_id: "user-1" },
      ...overrides,
    };
  }

  it("sets trialEndsAt from period_end when the item id matches", async () => {
    mockSelectLimit.mockResolvedValue([{ clerkSubscriptionItemId: "si_123" }]);

    await recordTrialEndingSoon(buildItemPayload());

    expect(mockUpdateSet).toHaveBeenCalledWith({
      trialEndsAt: new Date(1785000000000),
    });
  });

  it("no-ops when period_end is null", async () => {
    await recordTrialEndingSoon(buildItemPayload({ period_end: null }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("no-ops when payer.user_id is missing", async () => {
    await recordTrialEndingSoon(buildItemPayload({ payer: {} }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips a stale event for an item that's since been replaced", async () => {
    mockSelectLimit.mockResolvedValue([
      { clerkSubscriptionItemId: "si_newer" },
    ]);

    await recordTrialEndingSoon(buildItemPayload({ id: "si_123" }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
