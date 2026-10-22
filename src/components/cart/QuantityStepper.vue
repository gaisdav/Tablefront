<script setup lang="ts">
import { computed } from 'vue'
import { MAX_QUANTITY } from '@/domain/cart'

const quantity = defineModel<number>({ required: true })
const {
  label,
  min = 1,
  max = MAX_QUANTITY,
  removable,
  silent,
} = defineProps<{
  /** What is being counted, for assistive technology: "Quantity of Margherita pizza". */
  label: string
  min?: number
  max?: number
  /** At the minimum the minus button removes the item instead (the value becomes 0). */
  removable?: boolean
  /** Do not speak each new value, for where something else already announces the change. */
  silent?: boolean
}>()

const removes = computed(() => removable && quantity.value <= min)

// A button at its limit is `aria-disabled` rather than `disabled`: a really disabled button
// drops keyboard focus to the page just as the user reaches the limit.
function step(delta: number): void {
  if (delta < 0 && removes.value) {
    quantity.value = 0
    return
  }
  const next = quantity.value + delta
  if (next >= min && next <= max) quantity.value = next
}
</script>

<template>
  <div class="stepper" role="group" :aria-label="`Quantity of ${label}`">
    <button
      class="stepper__button"
      type="button"
      :class="{ 'stepper__button--remove': removes }"
      :aria-label="removes ? `Remove ${label} from cart` : 'Decrease quantity'"
      :aria-disabled="(quantity <= min && !removable) || undefined"
      @click="step(-1)"
    >
      <svg
        v-if="removes"
        class="stepper__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" />
      </svg>
      <template v-else>−</template>
    </button>
    <output class="stepper__value" :aria-live="silent ? undefined : 'polite'">
      {{ quantity }}
    </output>
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
  /* Inside the 1px border, so the whole control is exactly one tap target tall, like a button. */
  height: calc(var(--tap-size) - 2px);
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

.stepper__icon {
  width: 1.25rem;
  height: 1.25rem;
}

.stepper__button--remove {
  color: var(--color-danger);
}

.stepper__value {
  flex: 1;
  min-width: 2rem;
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-semibold);
  text-align: center;
}
</style>
