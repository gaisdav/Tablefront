<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AsyncBoundary from '@/components/AsyncBoundary.vue'
import BaseButton from '@/components/BaseButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import OrderCard from '@/components/order/OrderCard.vue'
import { useMyOrders, type OrderEntry } from '@/composables/useMyOrders'
import { isTerminalStatus } from '@/domain/orderStatus'
import { useMyOrdersStore } from '@/stores/myOrders'

const myOrders = useMyOrdersStore()
const router = useRouter()

const polling = useMyOrders(() => myOrders.ids)

// What is shown follows the remembered list at once (forgetting an order does not wait for the next
// refresh), in the order the orders were placed, newest first.
const entries = computed<OrderEntry[] | undefined>(() => {
  const data = polling.data.value
  if (data === undefined) return undefined
  return myOrders.ids
    .map((id) => data.find((entry) => entry.id === id))
    .filter((entry) => entry !== undefined)
})

const blockingError = computed(() => (entries.value === undefined ? polling.error.value : null))
const refreshFailed = computed(() => entries.value !== undefined && polling.error.value !== null)

function isActive(entry: OrderEntry): boolean {
  return entry.kind === 'order' && !isTerminalStatus(entry.order.status)
}

// Orders that can still change come first: that is what someone opening this page is after.
const active = computed(() =>
  (entries.value ?? []).flatMap((entry) =>
    isActive(entry) && entry.kind === 'order' ? [entry.order] : [],
  ),
)
const past = computed(() => (entries.value ?? []).filter((entry) => !isActive(entry)))
</script>

<template>
  <section class="orders">
    <h1>My orders</h1>

    <EmptyState
      v-if="myOrders.isEmpty"
      title="No orders yet"
      description="Orders you place on this device will show up here."
    >
      <template #action>
        <BaseButton @click="router.push({ name: 'menu' })">Browse the menu</BaseButton>
      </template>
    </EmptyState>

    <template v-else>
      <p class="text-muted">
        Orders placed in this browser. They are not tied to an account, so another device or a
        cleared browser will not show them.
      </p>

      <AsyncBoundary
        :data="entries"
        :error="blockingError"
        :is-loading="polling.isLoading.value"
        loading-label="Loading your orders"
        @retry="polling.refresh"
      >
        <template #default>
          <p v-if="refreshFailed" class="notice" role="status">
            Could not refresh your orders. Showing what we last knew; trying again shortly.
          </p>

          <section v-if="active.length > 0" class="group" aria-labelledby="active-heading">
            <h2 id="active-heading">In progress</h2>
            <ul class="list" role="list">
              <li v-for="order in active" :key="order.id">
                <OrderCard :order="order" />
              </li>
            </ul>
          </section>

          <section v-if="past.length > 0" class="group" aria-labelledby="past-heading">
            <h2 id="past-heading">Earlier</h2>
            <ul class="list" role="list">
              <li v-for="entry in past" :key="entry.id">
                <OrderCard v-if="entry.kind === 'order'" :order="entry.order" />
                <div v-else class="gone">
                  <p>
                    <strong>Order {{ entry.id }}</strong>
                    <span v-if="entry.kind === 'missing'"> no longer exists on the server. </span>
                    <span v-else>could not be loaded right now.</span>
                  </p>
                  <BaseButton
                    variant="ghost"
                    :aria-label="`Remove order ${entry.id} from the list`"
                    @click="myOrders.forget(entry.id)"
                  >
                    Remove
                  </BaseButton>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </AsyncBoundary>
    </template>
  </section>
</template>

<style scoped>
.orders {
  display: grid;
  gap: var(--space-4);
  max-width: 44rem;
}

.group {
  display: grid;
  gap: var(--space-3);
}

.list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}

.gone {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}
</style>
