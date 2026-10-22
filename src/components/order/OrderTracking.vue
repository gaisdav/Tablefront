<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isApiError } from '@/api/errors'
import { ordersApi } from '@/api/ordersApi'
import AsyncBoundary from '@/components/AsyncBoundary.vue'
import OrderSummary from '@/components/checkout/OrderSummary.vue'
import OrderStepper from '@/components/order/OrderStepper.vue'
import { usePolling } from '@/composables/usePolling'
import { isTerminalStatus, statusLabel } from '@/domain/orderStatus'
import type { Order } from '@/types/domain'

const { orderId, pollIntervalMs = 5000 } = defineProps<{
  orderId: string
  pollIntervalMs?: number
}>()

// Created once per order: the page keys this component by id, so another order gets a new poller.
const polling = usePolling((signal) => ordersApi.getOrder(orderId, signal), {
  intervalMs: pollIntervalMs,
  shouldStop: (order) => isTerminalStatus(order.status),
  // A 4xx (an unknown order) will not fix itself; a 5xx or a dropped connection might.
  isFatal: (error) => isApiError(error) && error.status >= 400 && error.status < 500,
})

// Once there is an order on screen, a failed refresh is a notice, not a replacement for the page.
const blockingError = computed(() =>
  polling.data.value === undefined ? polling.error.value : null,
)
const refreshFailed = computed(
  () => polling.data.value !== undefined && polling.error.value !== null,
)

// Side effect: say it out loud when the kitchen moves the order along.
const announcement = ref('')
watch(
  () => polling.data.value?.status,
  (status, previous) => {
    if (previous !== undefined && status !== undefined) {
      announcement.value = `Order status: ${statusLabel(status)}.`
    }
  },
)

function where(order: Order): string {
  return order.fulfillment === 'delivery'
    ? `Delivery to ${order.customer.address ?? 'your address'}`
    : 'Pickup at the restaurant'
}
</script>

<template>
  <AsyncBoundary
    :data="polling.data.value"
    :error="blockingError"
    :is-loading="polling.isLoading.value"
    loading-label="Loading your order"
    @retry="polling.refresh"
  >
    <template #default="{ data: order }">
      <article class="order">
        <header class="order__header">
          <p class="order__eyebrow text-muted">Order {{ order.id }}</p>
          <h1 class="order__title">
            {{ order.status === 'cancelled' ? 'Order cancelled' : statusLabel(order.status) }}
          </h1>
          <p class="text-muted">{{ where(order) }} · {{ order.customer.name }}</p>
        </header>

        <p v-if="order.status === 'cancelled'" class="order__cancelled" role="alert">
          This order was cancelled. If that is unexpected, please contact the restaurant.
        </p>
        <OrderStepper v-else :status="order.status" />

        <p v-if="refreshFailed" class="order__stale" role="status">
          Could not refresh the status. Showing the last known one; trying again shortly.
        </p>
        <p v-else-if="!polling.isStopped.value" class="order__live text-muted">
          This page updates by itself.
        </p>

        <OrderSummary heading="Items" :lines="order.lines" :total-cents="order.totalCents" />
      </article>
    </template>
  </AsyncBoundary>

  <p class="visually-hidden" role="status">{{ announcement }}</p>
</template>

<style scoped>
.order {
  display: grid;
  gap: var(--space-5);
  max-width: 40rem;
}

.order__header {
  display: grid;
  gap: var(--space-1);
}

.order__eyebrow {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.order__cancelled,
.order__stale {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
}

.order__cancelled {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.order__stale {
  background: var(--color-surface-sunken);
}

.order__live {
  font-size: var(--text-sm);
}
</style>
