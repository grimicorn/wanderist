import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import {
  subscriptions,
  PLAN,
  SUBSCRIPTION_STATUS,
  BILLING_CYCLE,
} from "../db/schema";

export type Plan = (typeof PLAN)[keyof typeof PLAN];
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
export type BillingCycle = (typeof BILLING_CYCLE)[keyof typeof BILLING_CYCLE];

// ---------------------------------------------------------------------------
// Clerk Billing webhook payload shapes.
//
// These are hand-written, minimal subsets of Clerk's real webhook JSON
// (verified against the BillingSubscriptionWebhookEventJSON /
// BillingSubscriptionItemWebhookEventJSON types shipped in @clerk/backend) —
// only the fields this module actually reads. Kept local (rather than
// importing @clerk/backend's internal JSON types) to match the existing
// pattern in server/api/webhooks/clerk.post.ts, which does the same for user
// events.
// ---------------------------------------------------------------------------

export interface ClerkBillingPayer {
  user_id?: string;
}

export interface ClerkBillingPlanRef {
  slug: string;
  period: "month" | "annual";
}

export interface ClerkBillingSubscriptionItemPayload {
  id: string;
  status: string;
  plan_period: "month" | "annual";
  period_end: number | null;
  plan?: ClerkBillingPlanRef | null;
  payer?: ClerkBillingPayer;
}

export interface ClerkBillingSubscriptionPayload {
  id: string;
  status: string;
  payer: ClerkBillingPayer;
  items: ClerkBillingSubscriptionItemPayload[];
}

export interface UserSubscription {
  plan: Plan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

const FREE_SUBSCRIPTION: UserSubscription = {
  plan: PLAN.DRIFTER,
  status: SUBSCRIPTION_STATUS.ACTIVE,
  billingCycle: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
};

// Clerk Plan slugs are chosen by a human when creating each Plan in the Clerk
// Dashboard (see README "Billing" section). The paid tiers must use these
// exact slugs — the free Drifter tier has no corresponding Clerk Plan at all.
const PLAN_SLUGS: Record<string, Plan> = {
  wanderer: PLAN.WANDERER,
  nomad: PLAN.NOMAD,
};

/** Maps a Clerk Plan slug to one of this app's paid plan tiers, or null if unrecognized. */
export function mapClerkPlanSlug(slug: string | null | undefined): Plan | null {
  if (!slug) {
    return null;
  }
  return PLAN_SLUGS[slug] ?? null;
}

/** Maps Clerk's plan period ("month" | "annual") to this app's billing cycle vocabulary. */
export function mapClerkPlanPeriod(
  period: string | null | undefined,
): BillingCycle | null {
  if (period === "month") {
    return BILLING_CYCLE.MONTHLY;
  }
  if (period === "annual") {
    return BILLING_CYCLE.YEARLY;
  }
  return null;
}

/**
 * Collapses Clerk's wider status vocabulary ('active' | 'past_due' |
 * 'canceled' | 'ended' | 'abandoned' | 'incomplete' | ...) onto this app's
 * three-value enum. Only "active" is treated as a distinct entitled state
 * from "past_due"; every other terminal status collapses to "canceled" since
 * enforcement only needs to know whether the row is currently entitled.
 */
export function mapClerkSubscriptionStatus(status: string): SubscriptionStatus {
  if (status === "active") {
    return SUBSCRIPTION_STATUS.ACTIVE;
  }
  if (status === "past_due") {
    return SUBSCRIPTION_STATUS.PAST_DUE;
  }
  return SUBSCRIPTION_STATUS.CANCELED;
}

/**
 * Returns the authenticated user's real subscription state, defaulting to the
 * free Drifter plan when no row exists at all.
 *
 * This reflects the row as Clerk reported it — including `plan` for a
 * `past_due` subscription — so callers like Settings can still show billing-
 * management UI (e.g. "update your card") for a customer whose payment is
 * failing. Use `getEffectivePlan` instead when the question is "what plan is
 * this user entitled to use right now" (enforcement), not "what does their
 * billing record say."
 */
export async function getSubscriptionForUser(
  userId: string,
): Promise<UserSubscription> {
  const database = getDb();
  const rows = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return FREE_SUBSCRIPTION;
  }

  return {
    plan: row.plan,
    status: row.status,
    billingCycle: row.billingCycle,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

/**
 * Returns the plan tier `userId` is entitled to use right now, for plan-limit
 * enforcement. A `past_due` or `canceled` row has no live entitlement, so
 * this collapses to the free Drifter plan even though `getSubscriptionForUser`
 * (used for display) still reports the real plan on the row. Treating
 * past_due the same as canceled (no grace period) is a product decision —
 * see the PR description for the human to confirm before launch.
 */
export async function getEffectivePlan(userId: string): Promise<Plan> {
  const subscription = await getSubscriptionForUser(userId);
  if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
    return PLAN.DRIFTER;
  }
  return subscription.plan;
}

/**
 * Upserts the local `subscriptions` row from a subscription.created /
 * subscription.updated / subscription.active / subscription.pastDue webhook
 * event. No-ops (rather than throwing) for shapes we don't handle, so unknown
 * or org-level (B2B) payloads don't fail webhook delivery — Clerk retries on
 * non-2xx, and there is nothing actionable to retry here.
 *
 * Guards against the same out-of-order-delivery risk as the item handlers
 * below: a stale event for a subscription that's since been superseded (e.g.
 * canceled, then replaced by a new one) must not resurrect the old row's plan
 * and re-grant entitlements to a churned user.
 */
export async function upsertSubscriptionFromEvent(
  payload: ClerkBillingSubscriptionPayload,
): Promise<void> {
  const userId = payload.payer?.user_id;
  if (!userId) {
    // Org-level (B2B) subscription, or a payload shape we don't recognize.
    // This app only bills individual users — nothing to sync.
    return;
  }

  const primaryItem = payload.items?.[0];
  const plan = mapClerkPlanSlug(primaryItem?.plan?.slug);
  if (!primaryItem || !plan) {
    // No item, or a plan slug this app doesn't map to a known tier (e.g. the
    // implicit free-plan container, if Clerk ever sends one). Nothing to sync.
    return;
  }

  const database = getDb();
  const existing = await getSubscriptionRow(database, userId);
  if (isStaleEvent(existing?.clerkSubscriptionId, payload.id)) {
    return;
  }

  const values = {
    userId,
    plan,
    status: mapClerkSubscriptionStatus(payload.status),
    billingCycle: mapClerkPlanPeriod(primaryItem.plan_period),
    currentPeriodEnd: primaryItem.period_end
      ? new Date(primaryItem.period_end)
      : null,
    clerkSubscriptionId: payload.id,
    clerkSubscriptionItemId: primaryItem.id,
  };

  await database
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: subscriptions.userId, set: values });
}

/**
 * Marks the user's subscription row canceled from a subscriptionItem.canceled
 * / subscriptionItem.ended / subscriptionItem.abandoned webhook event.
 *
 * Only applies when the incoming item matches the row's clerkSubscriptionItemId
 * (or the row has none recorded yet). Svix does not guarantee delivery order,
 * so an out-of-order "ended" event for a since-replaced item must not clobber
 * a newer, already-active subscription — the same risk already accepted for
 * user.updated in handleUserUpsert above.
 */
export async function markSubscriptionItemInactive(
  payload: ClerkBillingSubscriptionItemPayload,
): Promise<void> {
  const userId = payload.payer?.user_id;
  if (!userId) {
    return;
  }

  const database = getDb();
  const existing = await getSubscriptionRow(database, userId);
  if (isStaleEvent(existing?.clerkSubscriptionItemId, payload.id)) {
    return;
  }

  // Clear the recorded Clerk IDs along with the status. This app's B2C plans
  // are single-item, so a canceled item means the whole subscription is done.
  // Clearing the IDs (rather than leaving the old ones in place) means a
  // future subscription.created for a genuinely new subscription — e.g. the
  // user re-subscribes later — isn't rejected as a stale/out-of-order event by
  // upsertSubscriptionFromEvent's isStaleEvent check, which treats a row with
  // no recorded ID as never stale.
  await database
    .update(subscriptions)
    .set({
      status: SUBSCRIPTION_STATUS.CANCELED,
      clerkSubscriptionId: null,
      clerkSubscriptionItemId: null,
    })
    .where(eq(subscriptions.userId, userId));
}

/**
 * Records the trial end date from a subscriptionItem.freeTrialEnding webhook
 * event — the one Clerk Billing event that unambiguously indicates an active
 * trial window ending soon. Clerk's webhook JSON does not otherwise expose a
 * first-class "is in trial" flag at the subscription/item status level
 * (verified against the @clerk/backend type definitions), so trialEndsAt is
 * best-effort and only populated once this event fires (3 days before the
 * trial ends per Clerk's docs), not from day one of the trial.
 */
export async function recordTrialEndingSoon(
  payload: ClerkBillingSubscriptionItemPayload,
): Promise<void> {
  const userId = payload.payer?.user_id;
  if (!userId || !payload.period_end) {
    return;
  }

  const database = getDb();
  const existing = await getSubscriptionRow(database, userId);
  if (isStaleEvent(existing?.clerkSubscriptionItemId, payload.id)) {
    return;
  }

  await database
    .update(subscriptions)
    .set({ trialEndsAt: new Date(payload.period_end) })
    .where(eq(subscriptions.userId, userId));
}

type SubscriptionIdsRow = {
  clerkSubscriptionId: string | null;
  clerkSubscriptionItemId: string | null;
};

async function getSubscriptionRow(
  database: ReturnType<typeof getDb>,
  userId: string,
): Promise<SubscriptionIdsRow | undefined> {
  const rows = await database
    .select({
      clerkSubscriptionId: subscriptions.clerkSubscriptionId,
      clerkSubscriptionItemId: subscriptions.clerkSubscriptionItemId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0];
}

/**
 * True when a row already exists recording a *different* Clerk ID (subscription
 * or item, depending on the caller) than the one this webhook event is about —
 * i.e. this event is stale/out-of-order relative to a newer subscription
 * already recorded. No existing row, or a row with no ID recorded yet on that
 * field, is never considered stale (nothing to be stale relative to).
 */
function isStaleEvent(
  recordedId: string | null | undefined,
  incomingId: string,
): boolean {
  if (!recordedId) {
    return false;
  }
  return recordedId !== incomingId;
}
