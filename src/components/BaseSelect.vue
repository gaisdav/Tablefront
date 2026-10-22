<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

// Like BaseInput: `class` and `style` go to the wrapper, everything else to the <select>.
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

function selectAttrs(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([name]) => name !== 'class' && name !== 'style'),
  )
}

const model = defineModel<string>({ required: true })

const { label, options, error } = defineProps<{
  label: string
  options: readonly { value: string; label: string }[]
  error?: string
}>()

const id = useId()
const errorId = `${id}-error`
const describedBy = computed(() => (error ? errorId : undefined))
</script>

<template>
  <div class="field" :class="attrs.class" :style="attrs.style">
    <label class="field__label" :for="id">{{ label }}</label>
    <select
      v-bind="selectAttrs()"
      :id="id"
      v-model="model"
      class="field__select"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="error" :id="errorId" class="field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.field__select {
  min-height: var(--tap-size);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.field__select[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.field__error {
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
