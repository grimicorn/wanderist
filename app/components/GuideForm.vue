<template>
  <div class="guide-form" role="dialog" :aria-label="title">
    <div class="guide-form__title">{{ title }}</div>
    <form class="guide-form__body" @submit.prevent="handleSubmit">
      <InputText
        v-model="formTitle"
        label="Title"
        placeholder="Guide title…"
        required
      />
      <InputTextarea
        v-model="formBody"
        label="Body"
        placeholder="What should a fellow traveler know?"
        :rows="6"
      />
      <div class="guide-form__row">
        <label class="guide-form__field">
          <span class="guide-form__label">Read time (minutes)</span>
          <input
            v-model.number="formReadTimeMinutes"
            type="number"
            :min="MIN_READ_TIME_MINUTES"
            class="guide-form__number"
          />
        </label>
        <label class="guide-form__field">
          <span class="guide-form__label">Visibility</span>
          <select v-model="formVisibility" class="guide-form__select">
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
      </div>
      <div class="guide-form__acts">
        <button
          type="submit"
          class="btn btn--primary btn--sm"
          :disabled="!formTitle.trim() || pending"
        >
          <AppIcon name="check" :size="14" />
          {{ pending ? "saving…" : submitLabel }}
        </button>
        <button
          type="button"
          class="btn btn--outline btn--sm"
          @click="emit('cancel')"
        >
          cancel
        </button>
      </div>
      <p v-if="error" class="guide-form__error" role="alert">
        {{ error }}
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Guide, GuideVisibility } from "~/stores/guides";

const MIN_READ_TIME_MINUTES = 1;
const DEFAULT_READ_TIME_MINUTES = 5;

const props = withDefaults(
  defineProps<{
    title: string;
    submitLabel: string;
    initialGuide?: Guide | null;
    pending?: boolean;
    error?: string | null;
  }>(),
  {
    initialGuide: null,
    pending: false,
    error: null,
  },
);

const emit = defineEmits<{
  submit: [
    input: {
      title: string;
      body?: string;
      readTimeMinutes?: number;
      visibility?: GuideVisibility;
    },
  ];
  cancel: [];
}>();

const formTitle = ref(props.initialGuide?.title ?? "");
const formBody = ref(props.initialGuide?.body ?? "");
const formReadTimeMinutes = ref(
  props.initialGuide?.readTimeMinutes ?? DEFAULT_READ_TIME_MINUTES,
);
const formVisibility = ref<GuideVisibility>(
  props.initialGuide?.visibility ?? "private",
);

function handleSubmit(): void {
  const title = formTitle.value.trim();

  if (!title) {
    return;
  }

  emit("submit", {
    title,
    body: formBody.value.trim(),
    readTimeMinutes: formReadTimeMinutes.value,
    visibility: formVisibility.value,
  });
}
</script>

<style scoped>
.guide-form {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 16px;
  margin-bottom: 16px;
}
.guide-form__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
.guide-form__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.guide-form__row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.guide-form__field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--ink-2);
}
.guide-form__number,
.guide-form__select {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  padding: 8px 10px;
  font-size: 13px;
  color: var(--ink);
  outline: none;
}
.guide-form__number {
  width: 110px;
}
.guide-form__number:focus,
.guide-form__select:focus {
  border-color: var(--accent-line);
}
.guide-form__acts {
  display: flex;
  gap: 10px;
}
.guide-form__error {
  font-size: 12px;
  color: var(--error, #c0392b);
  margin: 0;
}
</style>
