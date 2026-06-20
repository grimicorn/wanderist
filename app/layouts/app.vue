<template>
  <div class="shell">
    <div
      class="scrim"
      :class="{ 'is-open': sidebarOpen }"
      @click="sidebarOpen = false"
    />
    <AppSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="main">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const sidebarOpen = ref(false);

provide("openSidebar", () => {
  sidebarOpen.value = true;
});
</script>
