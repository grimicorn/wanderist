<template>
  <div v-if="visible" :class="['alert', `alert--${intent}`]" role="alert">
    <AppIcon :name="iconName" :size="18" class="alert__ico" />
    <div class="alert__body">
      <p v-if="title" class="alert__title">{{ title }}</p>
      <p v-if="message || $slots.default" class="alert__msg">
        <slot>{{ message }}</slot>
      </p>
    </div>
    <button
      v-if="dismissible"
      class="alert__close"
      aria-label="Dismiss"
      @click="visible = false"
    >
      <AppIcon name="x" :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
type AlertIntent = "error" | "warning" | "success" | "info";

const INTENT_ICONS: Record<AlertIntent, string> = {
  error: "alert-circle",
  warning: "alert-triangle",
  success: "check-circle",
  info: "info",
};

const props = withDefaults(
  defineProps<{
    intent?: AlertIntent;
    title?: string;
    message?: string;
    dismissible?: boolean;
  }>(),
  {
    intent: "info",
    title: undefined,
    message: undefined,
    dismissible: false,
  },
);

const visible = ref(true);
const iconName = computed(() => INTENT_ICONS[props.intent]);
</script>
