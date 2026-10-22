<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import OrderSummary from '@/components/checkout/OrderSummary.vue'
import OrderStatusBadge from '@/components/order/OrderStatusBadge.vue'
import { formatPlacedAt } from '@/domain/orderPresentation'
import { allowedTransitions, statusLabel, transitionLabel } from '@/domain/orderStatus'
import type { Order, OrderStatus } from '@/types/domain'

const { order } = defineProps<{
  order: Order
  /** A change to this order is on its way to the server. */
  saving: boolean
}>()

const emit = defineEmits<{ 'change-status': [status: OrderStatus] }>()

const actions = useTemplateRef<HTMLElement>('actions')
const panel = useTemplateRef<HTMLElement>('panel')

// The button that was pressed is replaced by the next status's buttons (or none). If focus was on
// one, it follows to the first new button, or to the panel when there is nothing left to press, so
// a keyboard user is not dropped at the top of the page. A `pre` watcher still sees the old DOM.
watch(
  () => order.status,
  async () => {
    const hadFocus = actions.value?.contains(document.activeElement) ?? false
    if (!hadFocus) return
    await nextTick()
    const next = actions.value?.querySelector<HTMLElement>('button')
    ;(next ?? panel.value)?.focus()
  },
)
</script>

<template>
  <div ref="panel" class="detail" tabindex="-1">
    <p class="detail__status">
      <OrderStatusBadge :status="order.status" />
      <span class="text-muted">{{ formatPlacedAt(order.createdAt) }}</span>
    </p>

    <dl class="facts">
      <div>
        <dt>Customer</dt>
        <dd>{{ order.customer.name }}</dd>
      </div>
      <div>
        <dt>Phone</dt>
        <dd>
          <a :href="`tel:${order.customer.phone.replace(/\s+/g, '')}`">{{
            order.customer.phone
          }}</a>
        </dd>
      </div>
      <div>
        <dt>{{ order.fulfillment === 'delivery' ? 'Delivery to' : 'Collection' }}</dt>
        <dd>
          {{
            order.fulfillment === 'delivery'
              ? (order.customer.address ?? '—')
              : 'Pickup at the restaurant'
          }}
        </dd>
      </div>
    </dl>

    <OrderSummary heading="Items" :lines="order.lines" :total-cents="order.totalCents" />

    <section class="actions" aria-label="Change status">
      <div
        v-if="allowedTransitions(order.status, order.fulfillment).length > 0"
        ref="actions"
        class="actions__buttons"
      >
        <BaseButton
          v-for="status in allowedTransitions(order.status, order.fulfillment)"
          :key="status"
          :variant="status === 'cancelled' ? 'danger' : 'primary'"
          :loading="saving"
          @click="emit('change-status', status)"
        >
          {{ transitionLabel(status) }}
        </BaseButton>
      </div>
      <p v-else class="text-muted">
        This order is {{ statusLabel(order.status).toLowerCase() }}; nothing more can be done.
      </p>
    </section>
  </div>
</template>

<style scoped>
.detail {
  display: grid;
  gap: var(--space-4);
}

.detail:focus {
  outline: none;
}

.detail__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.facts {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.facts dt {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.actions__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
