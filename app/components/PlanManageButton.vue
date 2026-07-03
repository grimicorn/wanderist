<template>
  <SubscriptionDetailsButton>
    <button type="button" v-bind="$attrs">
      <slot />
    </button>
  </SubscriptionDetailsButton>
</template>

<script setup lang="ts">
/**
 * Wraps Clerk Billing's experimental <SubscriptionDetailsButton /> — opens
 * Clerk's own self-serve UI for viewing/canceling the current subscription.
 * Isolated behind this component for the same reason as PlanCheckoutButton:
 * only this file needs to change if Clerk's experimental billing API moves.
 */
import { SubscriptionDetailsButton } from "@clerk/vue/experimental";

defineOptions({ inheritAttrs: false });
</script>
