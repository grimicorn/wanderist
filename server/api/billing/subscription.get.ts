import { ensureUser } from "../../utils/auth";
import { getSubscriptionForUser } from "../../utils/subscriptions";

/**
 * GET /api/billing/subscription
 *
 * Returns the authenticated user's current plan, subscription status, billing
 * cycle, and trial/renewal dates — defaulting to the free Drifter plan when
 * no paid subscription exists. Used by the Settings "Plan & Billing" section.
 */
export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  return getSubscriptionForUser(userId);
});
