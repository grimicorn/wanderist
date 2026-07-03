<template>
  <button
    v-if="!planId"
    type="button"
    disabled
    :title="unconfiguredTitle"
    v-bind="$attrs"
  >
    <slot />
  </button>
  <CheckoutButton
    v-else
    :plan-id="planId"
    :plan-period="planPeriod"
    :new-subscription-redirect-url="redirectTo"
  >
    <button type="button" v-bind="$attrs">
      <slot />
    </button>
  </CheckoutButton>
</template>

<script setup lang="ts">
/**
 * Wraps Clerk Billing's experimental <CheckoutButton /> behind a project-level
 * component so the rest of the app depends on a stable, small prop surface
 * (tier + cycle) instead of Clerk's plan-ID/period vocabulary directly. Isolating
 * the import here means only this file needs to change if Clerk's experimental
 * billing API is renamed or stabilized.
 *
 * The Clerk Plan ID for each tier is dashboard-generated and read from runtime
 * config (see nuxt.config.ts / README "Billing" section) — this component
 * never invents one. Until a human configures it, the button renders disabled
 * rather than opening a checkout that would fail at runtime.
 */
import { CheckoutButton } from "@clerk/vue/experimental";

type PlanTier = "wanderer" | "nomad";
type BillingCycleOption = "monthly" | "yearly";

const props = defineProps<{
  tier: PlanTier;
  cycle: BillingCycleOption;
  /** Path or full URL to send the user to once checkout completes. */
  redirectTo?: string;
}>();

defineOptions({ inheritAttrs: false });

const config = useRuntimeConfig();

const unconfiguredTitle = "Checkout is not configured yet";

const planId = computed<string | null>(() => {
  const idsByTier: Record<PlanTier, string> = {
    wanderer: config.public.clerkPlanIdWanderer,
    nomad: config.public.clerkPlanIdNomad,
  };
  return idsByTier[props.tier] || null;
});

// Clerk Billing's own vocabulary is "month" | "annual"; this app's pricing UI
// uses "monthly" | "yearly" — translated at this one boundary.
const planPeriod = computed<"month" | "annual">(() =>
  props.cycle === "yearly" ? "annual" : "month",
);
</script>
