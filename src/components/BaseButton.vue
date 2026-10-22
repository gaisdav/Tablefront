<script setup lang="ts">
// Absent boolean props are false, so only `variant` and `type` need a default.
const {
  variant = 'primary',
  type = 'button',
  loading,
  disabled,
  block,
} = defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit' | 'reset'
  /** Shows a spinner and blocks clicks; the label stays so the button does not change width. */
  loading?: boolean
  disabled?: boolean
  /** Stretches to the full width of its container. */
  block?: boolean
}>()

const emit = defineEmits<{ click: [event: MouseEvent] }>()

// While loading the button stays enabled, so it keeps keyboard focus, and swallows the click
// instead. preventDefault also stops a submit button from submitting the form a second time.
function onClick(event: MouseEvent): void {
  if (loading) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    class="button"
    :class="[`button--${variant}`, { 'button--block': block }]"
    :type="type"
    :disabled="disabled"
    :aria-disabled="loading || undefined"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <span v-if="loading" class="button__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap-size);
  padding: var(--space-2) var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: var(--weight-semibold);
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.button:active:not(:disabled, [aria-busy='true']) {
  transform: translateY(1px);
}

.button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.button[aria-busy='true'] {
  opacity: 0.8;
  cursor: progress;
}

.button--block {
  display: flex;
  width: 100%;
}

.button--primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
  box-shadow: var(--shadow-sm);
}

.button--primary:hover:not(:disabled, [aria-busy='true']) {
  background: var(--color-accent-hover);
}

.button--secondary {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text);
}

.button--secondary:hover:not(:disabled, [aria-busy='true']) {
  background: var(--color-surface-sunken);
}

.button--ghost {
  background: transparent;
  color: var(--color-accent-text);
}

.button--ghost:hover:not(:disabled, [aria-busy='true']) {
  background: var(--color-accent-soft);
}

.button--danger {
  background: var(--color-danger);
  color: var(--color-on-danger);
}

.button--danger:hover:not(:disabled, [aria-busy='true']) {
  background: var(--color-danger-hover);
}

.button__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: var(--radius-full);
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

/* Reduced motion: no rotation, but the spinner must still read as "working", so it pulses. */
@media (prefers-reduced-motion: reduce) {
  .button__spinner {
    animation: pulse 1.4s ease-in-out infinite !important;
  }
}
</style>
