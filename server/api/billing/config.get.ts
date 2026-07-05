/**
 * GET /api/billing/config
 *
 * Returns which tier/cycle combinations have a Stripe Price ID configured,
 * read fresh from process.env on every request via getPriceId(). Used by
 * <PlanCheckoutButton> to decide whether to render disabled.
 *
 * Deliberately NOT exposed as a Nuxt public runtimeConfig boolean (e.g.
 * computed in nuxt.config.ts): those values are baked in once when Nuxt's
 * config runs and only get refreshed at request time by Nitro's own runtime
 * env-override convention, which requires the runtimeConfig key's derived
 * env var name (NUXT_PUBLIC_<KEY>) to match the var an operator actually
 * sets. STRIPE_PRICE_* are deliberately server-only (no NUXT_PUBLIC_ prefix
 * — see README "Billing"), so that convention can't apply here; a real
 * per-request server route is the only way to reflect the runtime
 * environment reliably.
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
