<script setup lang="ts">
import type { Category } from '@/types/domain'

/** The selected category id, or undefined for "All". */
const selected = defineModel<string | undefined>({ required: true })
defineProps<{ categories: Category[] }>()
</script>

<template>
  <!-- Filter buttons, not tabs: pressing one changes what the list shows, it does not switch panels. -->
  <div class="chips" role="group" aria-label="Filter by category">
    <button
      class="chip"
      type="button"
      :aria-pressed="selected === undefined"
      @click="selected = undefined"
    >
      All
    </button>
    <button
      v-for="category in categories"
      :key="category.id"
      class="chip"
      type="button"
      :aria-pressed="selected === category.id"
      @click="selected = category.id"
    >
      {{ category.name }}
    </button>
  </div>
</template>

<style scoped>
/* Phone: one row that scrolls sideways. Tablet and up: wraps. */
.chips {
  display: flex;
  gap: var(--space-2);
  padding-bottom: var(--space-1);
  overflow-x: auto;
  scroll-snap-type: x proximity;
}

.chip {
  flex: none;
  min-height: var(--tap-size);
  padding-inline: var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  cursor: pointer;
  scroll-snap-align: start;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.chip:hover {
  background: var(--color-surface-sunken);
}

.chip[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

@media (min-width: 48rem) {
  .chips {
    flex-wrap: wrap;
    overflow-x: visible;
  }
}
</style>
