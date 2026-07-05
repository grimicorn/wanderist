/**
 * GET /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the requested plan tier + billing
 * cycle and redirects the browser to Stripe's hosted checkout page.
 * Navigated to via a full-page redirect (window.location.href from
 * <PlanCheckoutButton>), the same convention
 * server/api/connections/instagram/start.get.ts uses for the other
 * "redirect to a hosted third-party flow" case in this app.
 */

import { ensureUser } from "../../utils/auth";
import { getStripeCustomerIdForUser } from "../../utils/subscriptions";
import {
  createCheckoutSession,
  getPriceId,
  type PlanTier,
  type BillingCycleOption,
} from "../../utils/stripe";

const VALID_TIERS: readonly PlanTier[] = ["wanderer", "nomad"];
const VALID_CYCLES: readonly BillingCycleOption[] = ["monthly", "yearly"];
const DEFAULT_SUCCESS_PATH = "/settings#billing";
const CANCEL_PATH = "/pricing";

function requireAppOrigin(): string {
  const origin = process.env.NUXT_PUBLIC_SITE_ORIGIN;
  if (!origin) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_PUBLIC_SITE_ORIGIN is not configured",
    });
  }
  return origin;
}

function parseTier(value: unknown): PlanTier {
  if (typeof value === "string" && VALID_TIERS.includes(value as PlanTier)) {
    return value as PlanTier;
  }
  throw createError({ statusCode: 400, statusMessage: "Invalid plan tier" });
}

function parseCycle(value: unknown): BillingCycleOption {
  if (
    typeof value === "string" &&
    VALID_CYCLES.includes(value as BillingCycleOption)
  ) {
    return value as BillingCycleOption;
  }
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid billing cycle",
  });
}

// Only a same-origin relative path is accepted, and "//host/..." is rejected
// even though it starts with "/" — browsers treat a protocol-relative URL as
// an absolute one, which would otherwise let this query param redirect to an
// external site after checkout (open-redirect).
function parseRedirectTo(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const query = getQuery(event);
  const tier = parseTier(query.tier);
  const cycle = parseCycle(query.cycle);
  const redirectTo = parseRedirectTo(query.redirectTo);

  const priceId = getPriceId(tier, cycle);
  if (!priceId) {
    throw createError({
      statusCode: 400,
      statusMessage: `Checkout for the ${tier} plan (${cycle}) is not configured`,
    });
  }

  const origin = requireAppOrigin();
  const existingCustomerId = await getStripeCustomerIdForUser(userId);

  const session = await createCheckoutSession({
    userId,
    priceId,
    existingCustomerId,
    successUrl: `${origin}${redirectTo ?? DEFAULT_SUCCESS_PATH}`,
    cancelUrl: `${origin}${CANCEL_PATH}`,
  });

  if (!session.url) {
    throw createError({
      statusCode: 502,
      statusMessage: "Stripe did not return a checkout URL",
    });
  }

  return sendRedirect(event, session.url, 302);
});
