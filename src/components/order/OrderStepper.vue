<script setup lang="ts">
import { computed } from 'vue'
import { progressSteps, statusLabel } from '@/domain/orderStatus'
import type { Fulfillment, OrderStatus } from '@/types/domain'

const { status, fulfillment } = defineProps<{ status: OrderStatus; fulfillment: Fulfillment }>()

// A delivery has one more step than a pickup.
const stepNames = computed(() => progressSteps(fulfillment))
const currentIndex = computed(() => stepNames.value.findIndex((step) => step === status))

type StepState = 'done' | 'current' | 'upcoming'

const steps = computed(() =>
  stepNames.value.map((step, index) => {
    const state: StepState =
      index < currentIndex.value ? 'done' : index === currentIndex.value ? 'current' : 'upcoming'
    return { step, label: statusLabel(step), state }
  }),
)

const stateText: Record<StepState, string> = {
  done: '(done)',
  current: '(current step)',
  upcoming: '(not yet)',
}
</script>

<template>
  <ol class="stepper" :style="{ '--steps': steps.length }">
    <li
      v-for="item in steps"
      :key="item.step"
      class="step"
      :class="`step--${item.state}`"
      :aria-current="item.state === 'current' ? 'step' : undefined"
    >
      <span class="step__marker" aria-hidden="true">{{ item.state === 'done' ? '✓' : '' }}</span>
      <span class="step__label">{{ item.label }}</span>
      <!-- The leading space keeps "Ready (current step)" from being read as one word. -->
      <span class="visually-hidden">{{ ' ' + stateText[item.state] }}</span>
    </li>
  </ol>
</template>

<style scoped>
.stepper {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
}

.step__marker {
  display: grid;
  flex: none;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
}

/* The line to the next step, vertical on a phone. */
.step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 1.75rem;
  left: calc(0.875rem - 1px);
  height: var(--space-4);
  width: 2px;
  background: var(--color-border-strong);
}

.step--done {
  color: var(--color-text);
}

.step--done .step__marker {
  border-color: var(--color-success);
  background: var(--color-success);
  color: var(--color-on-accent);
}

.step--done:not(:last-child)::after {
  background: var(--color-success);
}

.step--current {
  color: var(--color-text);
  font-weight: var(--weight-semibold);
}

.step--current .step__marker {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  box-shadow: 0 0 0 4px var(--color-accent-soft);
}

@media (min-width: 48rem) {
  .stepper {
    grid-template-columns: repeat(var(--steps), minmax(0, 1fr));
  }

  .step {
    flex-direction: column;
    text-align: center;
  }

  .step:not(:last-child)::after {
    top: calc(0.875rem - 1px);
    left: calc(50% + 1.25rem);
    width: calc(100% - 2.5rem + var(--space-4));
    height: 2px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .step__marker {
    transition:
      background-color var(--duration-base) var(--ease-out),
      border-color var(--duration-base) var(--ease-out);
  }
}
</style>
