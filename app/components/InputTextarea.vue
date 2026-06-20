<template>
  <div :class="['field', stateClass]">
    <label v-if="label" :for="inputId" class="field__label">
      {{ label }}
      <span v-if="required" class="req">*</span>
    </label>
    <div class="field__wrap">
      <textarea
        :id="inputId"
        v-bind="$attrs"
        class="field__input"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :rows="rows"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
      <span v-if="state !== 'default'" class="field__icon" style="top: 12px; bottom: auto;">
        <AppIcon v-if="stateIcon" :name="stateIcon" :size="16" />
      </span>
    </div>
    <p v-if="hint" class="field__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import type { InputState } from './InputText.vue'

const STATE_ICONS: Record<InputState, string | undefined> = {
  default: undefined,
  success: 'check-circle',
  error: 'alert-circle',
}

const STATE_CLASSES: Record<InputState, string | undefined> = {
  default: undefined,
  success: 'is-success',
  error: 'is-error',
}

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
  hint?: string
  state?: InputState
  required?: boolean
  disabled?: boolean
  rows?: number
}>(), {
  state: 'default',
  rows: 4,
})

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const inputId = useId()
const stateClass = computed(() => STATE_CLASSES[props.state])
const stateIcon = computed(() => STATE_ICONS[props.state])
</script>
