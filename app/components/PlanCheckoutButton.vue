<template>
  <button
    type="button"
    :disabled="!configured"
    :title="configured ? undefined : unconfiguredTitle"
    v-bind="$attrs"
    @click="startCheckout"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
/**
 * Redirects the browser to GET /api/billing/checkout, which creates a Stripe
 * Checkout Session server-side and 302s to Stripe's hosted checkout page —
 * the same "navigate to a server route that redirects to a hosted
 * third-party flow" convention app/composables/useConnections.ts uses for
 * Instagram OAuth.
 *
 * The Stripe Price ID for each tier/cycle is a human-configured, server-only
 * value (see server/utils/stripe.ts / README "Billing" section) that never
 * reaches the client; this component only knows whether one is configured
 * via useBillingConfig() (GET /api/billing/config, read fresh per request —
 * NOT a build-time Nuxt public runtimeConfig value, which wouldn't
 * reliably reflect a runtime-injected STRIPE_PRICE_* env var), and renders
 * disabled until it is, rather than opening a checkout that would fail.
 */
import { useBillingConfig } from "~/composables/useBillingConfig";

type PlanTier = "wanderer" | "nomad";
type BillingCycleOption = "monthly" | "yearly";

const props = defineProps<{
  tier: PlanTier;
  cycle: BillingCycleOption;
  /** Path to send the user to once checkout completes. */
  redirectTo?: string;
}>();

defineOptions({ inheritAttrs: false });

const unconfiguredTitle = "Checkout is not configured yet";

const { config, fetchBillingConfig } = useBillingConfig();

onMounted(() => {
  fetchBillingConfig();
});

const configured = computed<boolean>(() => {
  const flagsByTierAndCycle: Record<
    PlanTier,
    Record<BillingCycleOption, boolean>
  > = {
    wanderer: {
      monthly: config.value.wandererMonthlyConfigured,
      yearly: config.value.wandererYearlyConfigured,
    },
    nomad: {
      monthly: config.value.nomadMonthlyConfigured,
      yearly: config.value.nomadYearlyConfigured,
    },
  };
  return flagsByTierAndCycle[props.tier][props.cycle];
});

function startCheckout(): void {
  const params = new URLSearchParams({
    tier: props.tier,
    cycle: props.cycle,
  });
  if (props.redirectTo) {
    params.set("redirectTo", props.redirectTo);
  }
  window.location.href = `/api/billing/checkout?${params.toString()}`;
}
</script>
