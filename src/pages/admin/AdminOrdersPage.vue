<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import AdminOrderDetail from '@/components/admin/AdminOrderDetail.vue'
import AdminOrderRow from '@/components/admin/AdminOrderRow.vue'
import AsyncBoundary from '@/components/AsyncBoundary.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import ChipGroup, { type ChipOption } from '@/components/ChipGroup.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAdminOrders } from '@/composables/useAdminOrders'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { isOrderStatus } from '@/domain/guards'
import { statusLabel } from '@/domain/orderStatus'
import { ORDER_STATUSES, type OrderStatus } from '@/types/domain'

const route = useRoute()
const router = useRouter()
const board = useAdminOrders()
const { polling } = board

// Side by side on a wide window; on a narrower one the details open over the list instead.
const wide = useMediaQuery('(min-width: 64rem)')

function param(name: string): string | undefined {
  const value = route.query[name]
  const first = Array.isArray(value) ? value[0] : value
  return first === null || first === undefined || first === '' ? undefined : first
}

function withParam(name: string, value: string | undefined): LocationQuery {
  const others = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== name))
  return value === undefined ? others : { ...others, [name]: value }
}

// The URL holds the filter and the selected order, so a reload, a shared link and the back button
// all keep the view. `replace`: neither is a step worth going back through.
const statusFilter = computed<OrderStatus | undefined>({
  get: () => {
    const value = param('status')
    return isOrderStatus(value) ? value : undefined
  },
  set: (value) => {
    void router.replace({ query: withParam('status', value) })
  },
})
const selectedId = computed(() => param('order'))

function select(id: string | undefined): void {
  void router.replace({ query: withParam('order', id) })
}

const blockingError = computed(() =>
  board.orders.value === undefined ? polling.error.value : null,
)
const refreshFailed = computed(
  () => board.orders.value !== undefined && polling.error.value !== null,
)

const filterOptions = computed<ChipOption<OrderStatus | undefined>[]>(() => {
  const all = board.orders.value ?? []
  const count = (status: OrderStatus) => all.filter((order) => order.status === status).length
  return [
    { value: undefined, label: `All (${String(all.length)})` },
    ...ORDER_STATUSES.map((status) => ({
      value: status,
      label: `${statusLabel(status)} (${String(count(status))})`,
    })),
  ]
})

const visible = computed(() =>
  (board.orders.value ?? []).filter(
    (order) => statusFilter.value === undefined || order.status === statusFilter.value,
  ),
)

// Looked up among all orders, not only the visible ones: an order moved out of the filtered view
// stays open until the user closes it.
const selected = computed(() => board.orders.value?.find((order) => order.id === selectedId.value))

const dialogOpen = computed({
  get: () => !wide.value && selected.value !== undefined,
  set: (open) => {
    if (!open) select(undefined)
  },
})
</script>

<template>
  <section class="board">
    <header class="board__head">
      <h1>Orders</h1>
      <BaseButton variant="secondary" :loading="polling.isLoading.value" @click="polling.refresh">
        Refresh
      </BaseButton>
    </header>

    <ChipGroup v-model="statusFilter" legend="Filter by status" :options="filterOptions" />

    <AsyncBoundary
      :data="board.orders.value"
      :error="blockingError"
      :is-loading="polling.isLoading.value"
      loading-label="Loading orders"
      @retry="polling.refresh"
    >
      <template #empty>
        <EmptyState title="No orders yet" description="New orders appear here as they come in." />
      </template>

      <template #default>
        <p v-if="refreshFailed" class="notice" role="status">
          Could not refresh the orders. Showing the last known state; trying again shortly.
        </p>

        <div class="board__layout">
          <div>
            <ul v-if="visible.length > 0" class="list" role="list">
              <li v-for="order in visible" :key="order.id">
                <AdminOrderRow
                  :order="order"
                  :selected="order.id === selectedId"
                  @select="select(order.id === selectedId ? undefined : order.id)"
                />
              </li>
            </ul>
            <EmptyState
              v-else
              :title="`No ${statusFilter === undefined ? '' : statusLabel(statusFilter).toLowerCase() + ' '}orders`"
              description="Nothing matches this filter right now."
            />
          </div>

          <aside v-if="wide" class="detail" aria-label="Order details">
            <template v-if="selected">
              <h2 class="detail__title">Order {{ selected.id }}</h2>
              <AdminOrderDetail
                :order="selected"
                :saving="board.isSaving(selected.id)"
                @change-status="board.changeStatus(selected.id, $event)"
              />
            </template>
            <p v-else-if="selectedId !== undefined" class="text-muted">
              That order is no longer in the list.
              <BaseButton variant="ghost" @click="select(undefined)">Close</BaseButton>
            </p>
            <p v-else class="text-muted">
              Select an order to see its details and update its status.
            </p>
          </aside>
        </div>

        <BaseDialog
          v-if="selected"
          v-model:open="dialogOpen"
          :title="`Order ${selected.id}`"
          placement="side"
        >
          <AdminOrderDetail
            :order="selected"
            :saving="board.isSaving(selected.id)"
            @change-status="board.changeStatus(selected.id, $event)"
          />
        </BaseDialog>
      </template>
    </AsyncBoundary>
  </section>
</template>

<style scoped>
.board {
  display: grid;
  gap: var(--space-4);
}

.board__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}

.detail {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.detail__title {
  font-size: var(--text-lg);
}

@media (min-width: 64rem) {
  .board__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24rem;
    gap: var(--space-5);
    align-items: start;
  }

  .detail {
    position: sticky;
    top: var(--space-5);
    max-height: calc(100dvh - 2 * var(--space-5));
    overflow-y: auto;
  }
}
</style>
