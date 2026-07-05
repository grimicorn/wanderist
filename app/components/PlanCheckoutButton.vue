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
 * The Stripe Price ID for each tier/cycle is a human-configured value (see
 * nuxt.config.ts / README "Billing" section) that never reaches the client;
 * this component only knows whether one is configured via a public boolean
 * flag, and renders disabled until it is, rather than opening a checkout
 * that would fail at runtime.
 */
type PlanTier = "wanderer" | "nomad";
type BillingCycleOption = "monthly" | "yearly";

const props = defineProps<{
  tier: PlanTier;
  cycle: BillingCycleOption;
  /** Path to send the user to once checkout completes. */
  redirectTo?: string;
}>();

defineOptions({ inheritAttrs: false });

const config = useRuntimeConfig();

const unconfiguredTitle = "Checkout is not configured yet";

const configured = computed<boolean>(() => {
  const flagsByTierAndCycle: Record<
    PlanTier,
    Record<BillingCycleOption, boolean>
  > = {
    wanderer: {
      monthly: config.public.stripeWandererMonthlyConfigured,
      yearly: config.public.stripeWandererYearlyConfigured,
    },
    nomad: {
      monthly: config.public.stripeNomadMonthlyConfigured,
      yearly: config.public.stripeNomadYearlyConfigured,
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
