<script setup lang="ts">
import { useId } from 'vue'
import type { Fulfillment } from '@/types/domain'

const model = defineModel<Fulfillment>({ required: true })

const name = useId()

const options: { value: Fulfillment; title: string; description: string }[] = [
  { value: 'pickup', title: 'Pickup', description: 'Collect it at the restaurant' },
  { value: 'delivery', title: 'Delivery', description: 'We bring it to your address' },
]
</script>

<template>
  <!-- One of two: a radio group, so it is a single tab stop and the arrow keys switch. -->
  <fieldset class="choice">
    <legend class="choice__legend">How do you want to get it?</legend>
    <label v-for="option in options" :key="option.value" class="option">
      <input
        v-model="model"
        class="option__input"
        type="radio"
        :name="name"
        :value="option.value"
      />
      <span class="option__card">
        <span class="option__title">{{ option.title }}</span>
        <span class="option__description">{{ option.description }}</span>
      </span>
    </label>
  </fieldset>
</template>

<style scoped>
.choice {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  min-width: 0;
  border: 0;
  padding: 0;
}

.choice__legend {
  grid-column: 1 / -1;
  padding: 0;
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.option {
  display: block;
  cursor: pointer;
}

/* Visually hidden but still focusable: the card beside it shows the state. */
.option__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.option__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  height: 100%;
  min-height: var(--tap-size);
  padding: var(--space-3);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.option:hover .option__card {
  border-color: var(--color-text-muted);
}

.option__input:checked + .option__card {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

.option__input:focus-visible + .option__card {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.option__title {
  font-weight: var(--weight-semibold);
}

.option__description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* The soft fill is light in both themes' accent-soft; keep the muted text readable on it. */
.option__input:checked + .option__card .option__description {
  color: var(--color-text);
}
</style>
