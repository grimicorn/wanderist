<template>
  <div :class="['field', stateClass]">
    <label v-if="label" :for="inputId" class="field__label">
      {{ label }}
      <span v-if="required" class="req">*</span>
      <span v-if="hint && !modelValue" />
    </label>
    <div class="field__wrap">
      <input
        :id="inputId"
        v-bind="$attrs"
        class="field__input"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <span v-if="icon || state" class="field__icon">
        <AppIcon v-if="stateIcon" :name="stateIcon" :size="16" />
        <AppIcon v-else-if="icon" :name="icon" :size="16" />
      </span>
    </div>
    <p v-if="hint" class="field__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
export type InputState = 'default' | 'success' | 'error'

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
  type?: string
  icon?: string
  state?: InputState
  required?: boolean
  disabled?: boolean
}>(), {
  type: 'text',
  state: 'default',
})

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const inputId = useId()
const stateClass = computed(() => STATE_CLASSES[props.state])
const stateIcon = computed(() => STATE_ICONS[props.state])
</script>
