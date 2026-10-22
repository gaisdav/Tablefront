<script setup lang="ts">
import { useId } from 'vue'
import type { Category } from '@/types/domain'

/** The selected category id, or undefined for "All". */
const selected = defineModel<string | undefined>({ required: true })
defineProps<{ categories: Category[] }>()

const name = useId()
</script>

<template>
  <!-- Choosing one of several is a radio group: one tab stop for the whole row, arrow keys move
       and select, and assistive technology says "1 of 5". Native inputs give all of that for free. -->
  <fieldset class="chips">
    <legend class="visually-hidden">Filter by category</legend>
    <label class="chip">
      <input v-model="selected" class="chip__input" type="radio" :name="name" :value="undefined" />
      <span class="chip__label">All</span>
    </label>
    <label v-for="category in categories" :key="category.id" class="chip">
      <input
        v-model="selected"
        class="chip__input"
        type="radio"
        :name="name"
        :value="category.id"
      />
      <span class="chip__label">{{ category.name }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
/* Phone: one row that scrolls sideways. Tablet and up: wraps. */
.chips {
  display: flex;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0 0 var(--space-1);
  overflow-x: auto;
  border: 0;
  scroll-snap-type: x proximity;
}

.chip {
  position: relative;
  flex: none;
  scroll-snap-align: start;
}

/* The real input stays in the page for keyboard and screen readers; the label span is what is drawn. */
.chip__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.chip__label {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap-size);
  padding-inline: var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.chip:hover .chip__label {
  background: var(--color-surface-sunken);
}

.chip__input:checked + .chip__label {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.chip__input:focus-visible + .chip__label {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

@media (min-width: 48rem) {
  .chips {
    flex-wrap: wrap;
    overflow-x: visible;
  }
}
</style>
