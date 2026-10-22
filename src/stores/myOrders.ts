import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { loadOrderIds, MAX_REMEMBERED_ORDERS, saveOrderIds } from '@/stores/myOrdersStorage'

/**
 * The orders this browser has placed. There are no guest accounts, so the browser is the only
 * thing that ties a guest to their orders: only the ids are kept, and the page asks the API for
 * the current state of each, so nothing stale is ever shown as fact.
 */
export const useMyOrdersStore = defineStore('myOrders', () => {
  /** Newest first. */
  const ids = ref<string[]>(loadOrderIds())

  const isEmpty = computed(() => ids.value.length === 0)

  function remember(id: string): void {
    ids.value = [id, ...ids.value.filter((known) => known !== id)].slice(0, MAX_REMEMBERED_ORDERS)
  }

  function forget(id: string): void {
    ids.value = ids.value.filter((known) => known !== id)
  }

  // Side effect: keep the saved copy in step with the list.
  watch(ids, (value) => {
    saveOrderIds(value)
  })

  return { ids, isEmpty, remember, forget }
})
