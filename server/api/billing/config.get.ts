/**
 * GET /api/billing/config
 *
 * Returns which tier/cycle combinations have a Stripe Price ID configured,
 * resolved on every request via getPriceId() (a raw STRIPE_PRICE_* env var if
 * present, else the value baked into server runtimeConfig at build). Used by
 * <PlanCheckoutButton> to decide whether to render disabled.
 *
 * Deliberately kept server-only rather than exposed as a public runtimeConfig
 * boolean: the Price IDs carry no NUXT_PUBLIC_ prefix (see README "Billing")
 * and never need to reach the client — only these booleans do. A per-request
 * server route keeps the resolution in one place.
 */

import { getPriceId } from "../../utils/stripe";

export default defineEventHandler(() => {
  return {
    wandererMonthlyConfigured: Boolean(getPriceId("wanderer", "monthly")),
    wandererYearlyConfigured: Boolean(getPriceId("wanderer", "yearly")),
    nomadMonthlyConfigured: Boolean(getPriceId("nomad", "monthly")),
    nomadYearlyConfigured: Boolean(getPriceId("nomad", "yearly")),
  };
});
