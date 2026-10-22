<script setup lang="ts">
import { MAX_QUANTITY } from '@/domain/cart'

const quantity = defineModel<number>({ required: true })
const {
  label,
  min = 1,
  max = MAX_QUANTITY,
} = defineProps<{
  /** What is being counted, for assistive technology: "Quantity of Margherita pizza". */
  label: string
  min?: number
  max?: number
}>()

// A button at its limit is `aria-disabled` rather than `disabled`: a really disabled button
// drops keyboard focus to the page just as the user reaches the limit.
function step(delta: number): void {
  const next = quantity.value + delta
  if (next >= min && next <= max) quantity.value = next
}
</script>

<template>
  <div class="stepper" role="group" :aria-label="`Quantity of ${label}`">
    <button
      class="stepper__button"
      type="button"
      aria-label="Decrease quantity"
      :aria-disabled="quantity <= min || undefined"
      @click="step(-1)"
    >
      −
    </button>
    <output class="stepper__value" aria-live="polite">{{ quantity }}</output>
    <button
      class="stepper__button"
      type="button"
      aria-label="Increase quantity"
      :aria-disabled="quantity >= max || undefined"
      @click="step(1)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  background: var(--color-surface);
}

.stepper__button {
  display: grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  font-size: var(--text-xl);
  line-height: 1;
  cursor: pointer;
}

.stepper__button:hover:not([aria-disabled='true']) {
  background: var(--color-surface-sunken);
}

.stepper__button[aria-disabled='true'] {
  color: var(--color-text-muted);
  opacity: 0.45;
  cursor: not-allowed;
}

.stepper__value {
  min-width: 2rem;
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-semibold);
  text-align: center;
}
</style>
