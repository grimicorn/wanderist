import type Stripe from "stripe";
import {
  constructStripeEvent,
  requireStripeWebhookSecret,
} from "../../utils/stripe";
import {
  upsertSubscriptionFromStripeSubscription,
  markSubscriptionCanceled,
} from "../../utils/subscriptions";

const STRIPE_SIGNATURE_HEADER = "stripe-signature";

const EVENT_SUBSCRIPTION_CREATED = "customer.subscription.created";
const EVENT_SUBSCRIPTION_UPDATED = "customer.subscription.updated";
const EVENT_SUBSCRIPTION_DELETED = "customer.subscription.deleted";
// Stripe recommends syncing subscription state from customer.subscription.*
// events, not checkout.session.completed — the session doesn't carry the
// full Subscription fields (status, items, trial, period) this app needs,
// and customer.subscription.created fires around the same time carrying all
// of them. This event is still explicitly acknowledged (not left to fall
// through to the generic "unknown event" branch) so it's clear in the event
// list below that it was considered, not missed.
const EVENT_CHECKOUT_SESSION_COMPLETED = "checkout.session.completed";

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  const signature = getHeader(event, STRIPE_SIGNATURE_HEADER);
  if (!signature) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Stripe-Signature header",
    });
  }

  const secret = requireStripeWebhookSecret();

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = constructStripeEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("Stripe webhook: signature verification failed", error);
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid webhook signature",
    });
  }

  if (
    stripeEvent.type === EVENT_SUBSCRIPTION_CREATED ||
    stripeEvent.type === EVENT_SUBSCRIPTION_UPDATED
  ) {
    await upsertSubscriptionFromStripeSubscription(
      stripeEvent.data.object as Stripe.Subscription,
    );
    return { ok: true };
  }

  if (stripeEvent.type === EVENT_SUBSCRIPTION_DELETED) {
    await markSubscriptionCanceled(
      stripeEvent.data.object as Stripe.Subscription,
    );
    return { ok: true };
  }

  if (stripeEvent.type === EVENT_CHECKOUT_SESSION_COMPLETED) {
    return { ok: true };
  }

  // Unknown event types are acknowledged without error so Stripe does not retry.
  return { ok: true };
});
