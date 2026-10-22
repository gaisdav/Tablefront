<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

// `class` and `style` style the wrapper, so layout rules (grid placement, margins) move the whole
// field. Every other attribute (`name`, `autocomplete`, `required`, `placeholder`, ...) goes to
// the <input>. `id`, `type`, `aria-invalid` and `aria-describedby` are owned by this component
// and cannot be overridden: they keep the label and messages wired to the input.
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

function inputAttrs(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([name]) => name !== 'class' && name !== 'style'),
  )
}

const model = defineModel<string>({ required: true })

const {
  label,
  type = 'text',
  hint,
  error,
  multiline,
} = defineProps<{
  /** Always visible: a placeholder is not a label. */
  label: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'search' | 'url'
  hint?: string
  /** Shown under the field and announced with it; also marks the field invalid. */
  error?: string
  /** A text area for longer text; `type` does not apply. */
  multiline?: boolean
}>()

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`

const describedBy = computed(() => {
  const ids = [hint ? hintId : null, error ? errorId : null].filter((value) => value !== null)
  return ids.length > 0 ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="field" :class="attrs.class" :style="attrs.style">
    <label class="field__label" :for="id">{{ label }}</label>
    <textarea
      v-if="multiline"
      v-bind="inputAttrs()"
      :id="id"
      v-model="model"
      class="field__input field__input--multiline"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
    />
    <input
      v-else
      v-bind="inputAttrs()"
      :id="id"
      v-model="model"
      class="field__input"
      :type="type"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
    />
    <p v-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
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

.field__input {
  min-height: var(--tap-size);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field__input--multiline {
  min-height: 6rem;
  resize: vertical;
}

.field__input:hover {
  border-color: var(--color-text-muted);
}

.field__input[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.field__hint,
.field__error {
  font-size: var(--text-sm);
}

.field__hint {
  color: var(--color-text-muted);
}

.field__error {
  color: var(--color-danger);
}
</style>
