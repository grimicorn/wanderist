/**
 * InputText/InputTextarea are resolved via Nuxt's components/ auto-import at
 * build time, which plain Vitest can't do — stub them with a working
 * v-model relay so setValue() interactions in tests still reach the
 * consuming component's refs.
 */
export const inputStub = {
  props: ["modelValue", "label", "placeholder", "required"],
  emits: ["update:modelValue"],
  template:
    '<input :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};

export const textareaStub = {
  props: ["modelValue", "label", "placeholder", "rows"],
  emits: ["update:modelValue"],
  template:
    '<textarea :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
};
