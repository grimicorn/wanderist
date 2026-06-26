<template>
  <div class="theme-toggle">
    <button
      :class="{ 'is-active': theme === 'light' }"
      aria-label="Light theme"
      @click="setTheme('light')"
    >
      <AppIcon name="sun" :size="14" />
    </button>
    <button
      :class="{ 'is-active': theme === 'dark' }"
      aria-label="Dark theme"
      @click="setTheme('dark')"
    >
      <AppIcon name="moon" :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
const { theme, setTheme } = useTheme();
</script>
