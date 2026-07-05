import Stripe from "stripe";

export type PlanTier = "wanderer" | "nomad";
export type BillingCycleOption = "monthly" | "yearly";

let cachedStripeClient: Stripe | null = null;

export function requireStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return secretKey;
}

/**
 * Returns a cached Stripe client.
 * Isolated here (alongside the rest of this file) so every Stripe API call
 * shares one client instance and the dependency can be mocked in tests
 * without any network access — see server/utils/clerk.ts for the same pattern
 * applied to the Clerk backend SDK.
 */
export function getStripeClient(): Stripe {
  if (cachedStripeClient) {
    return cachedStripeClient;
  }
  // No apiVersion pinned: the installed `stripe` package pins its own default
  // API version internally, which is the standard recommendation for most
  // integrations (see Stripe Node SDK docs) and one less version string to
  // keep in sync by hand.
  cachedStripeClient = new Stripe(requireStripeSecretKey());
  return cachedStripeClient;
}

// Maps this app's plan tier + billing cycle vocabulary to the Stripe Price ID
// a human configures per-environment after creating the corresponding Price
// in the Stripe Dashboard (see README "Billing" section). These are
// deliberately read from process.env directly (like STRIPE_SECRET_KEY above),
// not public runtimeConfig — the actual Price ID never needs to reach the
// client; nuxt.config.ts separately exposes only a "configured" boolean per
// tier/cycle so checkout buttons know whether to render disabled.
const PRICE_ID_ENV_VAR: Record<PlanTier, Record<BillingCycleOption, string>> = {
  wanderer: {
    monthly: "STRIPE_PRICE_WANDERER_MONTHLY",
    yearly: "STRIPE_PRICE_WANDERER_YEARLY",
  },
  nomad: {
    monthly: "STRIPE_PRICE_NOMAD_MONTHLY",
    yearly: "STRIPE_PRICE_NOMAD_YEARLY",
  },
};

/** Returns the configured Stripe Price ID for a tier + cycle, or null if unset. */
export function getPriceId(
  tier: PlanTier,
  cycle: BillingCycleOption,
): string | null {
  return process.env[PRICE_ID_ENV_VAR[tier][cycle]] || null;
}

/**
 * Reverse lookup from a Stripe Price ID (as it appears on a subscription
 * item) back to this app's plan tier + billing cycle. Built once per call
 * from the same env vars getPriceId reads, so the two can never drift apart.
 */
export function mapPriceIdToPlan(
  priceId: string | null | undefined,
): { plan: PlanTier; cycle: BillingCycleOption } | null {
  if (!priceId) {
    return null;
  }
  for (const tier of Object.keys(PRICE_ID_ENV_VAR) as PlanTier[]) {
    for (const cycle of Object.keys(
      PRICE_ID_ENV_VAR[tier],
    ) as BillingCycleOption[]) {
      if (getPriceId(tier, cycle) === priceId) {
        return { plan: tier, cycle };
      }
    }
  }
  return null;
}

export interface CreateCheckoutSessionParams {
  userId: string;
  priceId: string;
  existingCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe Checkout Session for a new subscription and returns its
 * hosted URL. `subscription_data.metadata.userId` is the sync key every
 * subsequent `customer.subscription.*` webhook event carries directly on the
 * Subscription object — see server/utils/subscriptions.ts — so no separate
 * customer-id lookup is needed to attribute those events back to this user.
 * Reuses `existingCustomerId` when the user already has a Stripe customer
 * (e.g. a past subscriber resubscribing) instead of creating a duplicate one.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    client_reference_id: params.userId,
    customer: params.existingCustomerId ?? undefined,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: { metadata: { userId: params.userId } },
  });
}

export interface CreateBillingPortalSessionParams {
  customerId: string;
  returnUrl: string;
}

/** Creates a Stripe Billing Portal session and returns its hosted URL. */
export async function createBillingPortalSession(
  params: CreateBillingPortalSessionParams,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

export function requireStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return secret;
}

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 * Isolated here so callers can stub this seam in tests without network
 * access — mirrors server/utils/svix.ts for the Clerk webhook.
 */
export function constructStripeEvent(
  rawBody: string,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
