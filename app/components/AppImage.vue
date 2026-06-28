<template>
  <img
    v-if="src"
    :src="src"
    :alt="alt"
    :class="['app-image', props.class]"
    loading="lazy"
    decoding="async"
  />
  <div
    v-else
    :class="['ph', 'app-image--placeholder', props.class]"
    :aria-label="alt || 'Image placeholder'"
    role="img"
  >
    <div class="topo" style="opacity: 0.4" />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Media URL from the API; omit or pass null/undefined to show the placeholder. */
    src?: string | null;
    /** Accessible alt text for the image or placeholder. */
    alt?: string;
    /** Additional CSS classes forwarded to the root element. */
    class?: string;
  }>(),
  {
    src: undefined,
    alt: "",
    class: "",
  },
);
</script>
