<script setup lang="ts">
import { RouterLink } from 'vue-router'
import OrderStatusBadge from '@/components/order/OrderStatusBadge.vue'
import { formatCents } from '@/domain/money'
import { formatPlacedAt, summarizeLines } from '@/domain/orderPresentation'
import type { Order } from '@/types/domain'

defineProps<{
  order: Order
  /** The last refresh of this order failed; the status shown may be behind. */
  stale?: boolean
}>()
</script>

<template>
  <article class="card">
    <div class="card__head">
      <h3 class="card__title">
        <!-- The link covers the whole card (see ::after), so the card is one big target. -->
        <RouterLink class="card__link" :to="{ name: 'order', params: { id: order.id } }">
          Order {{ order.id }}
        </RouterLink>
      </h3>
      <OrderStatusBadge :status="order.status" />
    </div>
    <p v-if="stale" class="card__stale">
      Could not refresh this order; its status may be out of date.
    </p>
    <p class="card__items">{{ summarizeLines(order.lines) }}</p>
    <p class="card__meta text-muted">
      <time :datetime="order.createdAt">{{ formatPlacedAt(order.createdAt) }}</time>
      <span aria-hidden="true">·</span>
      <span>{{ order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup' }}</span>
      <span aria-hidden="true">·</span>
      <span class="card__total">{{ formatCents(order.totalCents) }}</span>
    </p>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.card:hover {
  border-color: var(--color-border-strong);
}

.card:has(.card__link:focus-visible) {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
}

.card__title {
  font-size: var(--text-base);
}

.card__link {
  color: var(--color-text);
  text-decoration: none;
}

.card__link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-lg);
}

.card__link:focus-visible {
  outline: none;
}

.card__stale {
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.card__items {
  overflow-wrap: anywhere;
}

.card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  font-size: var(--text-sm);
}

.card__total {
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}
</style>
