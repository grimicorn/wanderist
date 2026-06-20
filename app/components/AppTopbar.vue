<template>
  <header class="topbar">
    <button
      class="icon-btn menu-btn"
      aria-label="Menu"
      @click="openSidebar?.()"
    >
      <AppIcon name="menu" :size="16" />
    </button>

    <div>
      <div v-if="crumb" class="topbar__crumb">{{ crumb }}</div>
      <div class="topbar__title">{{ title }}</div>
    </div>

    <div class="topbar__actions">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  crumb?: string;
}>();

const openSidebar = inject<(() => void) | undefined>("openSidebar", undefined);
</script>
