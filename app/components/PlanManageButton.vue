<template>
  <button type="button" v-bind="$attrs" @click="openBillingPortal">
    <slot />
  </button>
</template>

<script setup lang="ts">
/**
 * Redirects the browser to GET /api/billing/portal, which creates a Stripe
 * Billing Portal session server-side and 302s the user there to view
 * invoices, update their payment method, or cancel — mirrors
 * PlanCheckoutButton's redirect-to-a-server-route convention.
 *
 * Only rendered by callers once the user already has a paid-tier
 * subscription row (see app/pages/settings.vue), so there is no
 * "unconfigured" state to handle here the way PlanCheckoutButton has to.
 */
defineOptions({ inheritAttrs: false });

function openBillingPortal(): void {
  window.location.href = "/api/billing/portal";
}
</script>
