/**
 * Tests for GET /api/billing/subscription
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnsureUser = vi.fn();
const mockGetSubscriptionForUser = vi.fn();

vi.mock("../../../server/utils/auth", () => ({
  ensureUser: mockEnsureUser,
}));

vi.mock("../../../server/utils/subscriptions", () => ({
  getSubscriptionForUser: mockGetSubscriptionForUser,
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
});

const { default: handler } =
  await import("../../../server/api/billing/subscription.get");

describe("GET /api/billing/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
  });

  it("returns the authenticated user's subscription", async () => {
    const subscription = {
      plan: "wanderer",
      status: "active",
      billingCycle: "monthly",
      trialEndsAt: null,
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
    };
    mockGetSubscriptionForUser.mockResolvedValue(subscription);

    const result = await (handler as (event: object) => Promise<unknown>)({});

    expect(mockGetSubscriptionForUser).toHaveBeenCalledWith("user-1");
    expect(result).toEqual(subscription);
  });

  it("propagates a 401 when the user is not authenticated", async () => {
    mockEnsureUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );

    await expect(
      (handler as (event: object) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
