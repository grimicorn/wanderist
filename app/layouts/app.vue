<template>
  <div class="shell" :data-auth-ready="isLoaded">
    <div
      class="scrim"
      :class="{ 'is-open': sidebarOpen }"
      @click="sidebarOpen = false"
    />
    <AppSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="main">
      <slot />
    </div>
    <AppNewEntry :open="newEntryOpen" @close="newEntryOpen = false" />
    <AppNotifications
      :open="notificationsOpen"
      @close="notificationsOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
// Auth resolves client-side only (Clerk's skipServerMiddleware: true), so this
// SSR-rendered shell is interactive-looking before Clerk finishes loading and
// its watchers/redirects settle. Exposing isLoaded as a data attribute gives
// e2e tests a real "safe to interact" signal instead of racing on paint.
const { isLoaded } = useClerkAuth();

const sidebarOpen = ref(false);
const newEntryOpen = ref(false);
const notificationsOpen = ref(false);

provide("openSidebar", () => {
  sidebarOpen.value = true;
});

provide("openNewEntry", () => {
  newEntryOpen.value = true;
});

provide("openNotifications", () => {
  notificationsOpen.value = true;
});
</script>
