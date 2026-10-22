<script setup lang="ts">
import OrderStatusBadge from '@/components/order/OrderStatusBadge.vue'
import { formatCents } from '@/domain/money'
import { formatPlacedAt } from '@/domain/orderPresentation'
import type { Order } from '@/types/domain'

defineProps<{
  order: Order
  selected: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <!-- A button, not a link: choosing a row shows its details beside the list, it does not leave. -->
  <button class="row" type="button" :aria-pressed="selected" @click="$emit('select')">
    <span class="row__head">
      <span class="row__id">{{ order.id }}</span>
      <OrderStatusBadge :status="order.status" />
    </span>
    <span class="row__customer">{{ order.customer.name }}</span>
    <span class="row__meta text-muted">
      {{ formatPlacedAt(order.createdAt) }} ·
      {{ order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup' }} ·
      <span class="row__total">{{ formatCents(order.totalCents) }}</span>
    </span>
  </button>
</template>

<style scoped>
.row {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.row:hover {
  border-color: var(--color-border-strong);
}

.row[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

.row__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.row__id {
  font-weight: var(--weight-semibold);
}

.row__customer {
  overflow-wrap: anywhere;
}

.row__meta {
  font-size: var(--text-sm);
}

.row[aria-pressed='true'] .row__meta {
  color: var(--color-text);
}

.row__total {
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}
</style>
