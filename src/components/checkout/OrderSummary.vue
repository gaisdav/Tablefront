<script setup lang="ts">
import { formatCents } from '@/domain/money'
import type { Cents } from '@/types/domain'

export interface SummaryLine {
  menuItemId: string
  name: string
  unitPriceCents: Cents
  quantity: number
  note?: string | undefined
}

const { heading = 'Your order' } = defineProps<{
  heading?: string
  lines: readonly SummaryLine[]
  totalCents: Cents
}>()
</script>

<template>
  <section class="summary" aria-labelledby="summary-heading">
    <h2 id="summary-heading" class="summary__heading">{{ heading }}</h2>
    <ul class="summary__lines">
      <li v-for="line in lines" :key="line.menuItemId" class="line">
        <span class="line__quantity">{{ line.quantity }}×</span>
        <span class="line__name">
          {{ line.name }}
          <span v-if="line.note" class="line__note text-muted">{{ line.note }}</span>
        </span>
        <span class="line__total">{{ formatCents(line.unitPriceCents * line.quantity) }}</span>
      </li>
    </ul>
    <p class="summary__total">
      <span>Total</span>
      <span>{{ formatCents(totalCents) }}</span>
    </p>
  </section>
</template>

<style scoped>
.summary {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.summary__heading {
  margin-bottom: var(--space-3);
  font-size: var(--text-lg);
}

.summary__lines {
  display: grid;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}

.line {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-2);
  align-items: baseline;
}

.line__quantity,
.line__total {
  font-variant-numeric: tabular-nums;
}

.line__quantity {
  color: var(--color-text-muted);
}

.line__note {
  display: block;
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.summary__total {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
}
</style>
