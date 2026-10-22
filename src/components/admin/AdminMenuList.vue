<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { formatCents } from '@/domain/money'
import type { Category, MenuItem } from '@/types/domain'

const { categories } = defineProps<{
  items: readonly MenuItem[]
  categories: readonly Category[]
  /** Ids of dishes whose availability is being saved. */
  saving: ReadonlySet<string>
}>()

defineEmits<{
  'set-available': [item: MenuItem, available: boolean]
  edit: [item: MenuItem]
  delete: [item: MenuItem]
}>()

// A real table where there is room for one; stacked cards (a list) on a phone. Two renderings of
// the same data rather than a table bent into cards by CSS, which would lose its table semantics.
const wide = useMediaQuery('(min-width: 48rem)')

function categoryName(id: string): string {
  return categories.find((category) => category.id === id)?.name ?? '—'
}
</script>

<template>
  <table v-if="wide" class="table">
    <thead>
      <tr>
        <th scope="col">Dish</th>
        <th scope="col">Category</th>
        <th scope="col" class="num">Price</th>
        <th scope="col">Available</th>
        <th scope="col"><span class="visually-hidden">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.id">
        <th scope="row" class="name">
          <span class="name__text">{{ item.name }}</span>
          <span class="name__description text-muted">{{ item.description }}</span>
        </th>
        <td>{{ categoryName(item.categoryId) }}</td>
        <td class="num">{{ formatCents(item.priceCents) }}</td>
        <td>
          <ToggleSwitch
            :checked="item.available"
            :label="`${item.name} available`"
            :busy="saving.has(item.id)"
            @toggle="$emit('set-available', item, $event)"
          />
        </td>
        <td class="actions">
          <BaseButton
            variant="ghost"
            :aria-label="`Edit ${item.name}`"
            :loading="saving.has(item.id)"
            @click="$emit('edit', item)"
          >
            Edit
          </BaseButton>
          <BaseButton
            variant="ghost"
            :aria-label="`Delete ${item.name}`"
            :loading="saving.has(item.id)"
            @click="$emit('delete', item)"
          >
            Delete
          </BaseButton>
        </td>
      </tr>
    </tbody>
  </table>

  <ul v-else class="cards" role="list">
    <li v-for="item in items" :key="item.id" class="card">
      <div class="card__head">
        <p class="name__text">{{ item.name }}</p>
        <p class="card__price">{{ formatCents(item.priceCents) }}</p>
      </div>
      <p class="text-muted card__category">{{ categoryName(item.categoryId) }}</p>
      <div class="card__foot">
        <span class="card__available">
          <ToggleSwitch
            :checked="item.available"
            :label="`${item.name} available`"
            :busy="saving.has(item.id)"
            @toggle="$emit('set-available', item, $event)"
          />
          {{ item.available ? 'Available' : 'Sold out' }}
        </span>
        <span class="actions">
          <BaseButton
            variant="ghost"
            :aria-label="`Edit ${item.name}`"
            :loading="saving.has(item.id)"
            @click="$emit('edit', item)"
          >
            Edit
          </BaseButton>
          <BaseButton
            variant="ghost"
            :aria-label="`Delete ${item.name}`"
            :loading="saving.has(item.id)"
            @click="$emit('delete', item)"
          >
            Delete
          </BaseButton>
        </span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.table th,
.table td {
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: middle;
}

.table thead th {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.table tbody tr:last-child > * {
  border-bottom: 0;
}

.name {
  font-weight: inherit;
}

.name__text {
  display: block;
  font-weight: var(--weight-semibold);
}

.name__description {
  display: -webkit-box;
  max-width: 28rem;
  overflow: hidden;
  font-size: var(--text-sm);
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
}

.num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-1);
}

.table td.actions {
  display: table-cell;
  text-align: right;
  white-space: nowrap;
}

.cards {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.card {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.card__price {
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.card__category {
  font-size: var(--text-sm);
}

.card__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.card__available {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}
</style>
