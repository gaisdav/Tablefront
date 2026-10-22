import { defineStore } from 'pinia'
import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import {
  loadOrderIds,
  MAX_REMEMBERED_ORDERS,
  saveOrderIds,
  STORAGE_KEY,
} from '@/stores/myOrdersStorage'

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

/**
 * The orders this browser has placed. There are no guest accounts, so the browser is the only
 * thing that ties a guest to their orders: only the ids are kept, and the page asks the API for
 * the current state of each, so nothing stale is ever shown as fact.
 */
export const useMyOrdersStore = defineStore('myOrders', () => {
  /** Newest first. */
  const ids = ref<string[]>(loadOrderIds())

  const isEmpty = computed(() => ids.value.length === 0)

  // Another tab may have placed an order since this one last looked, and saving only what this
  // tab knows would erase it. So a change starts from what is saved as well as from what is here.
  function remember(id: string): void {
    ids.value = unique([id, ...ids.value, ...loadOrderIds()]).slice(0, MAX_REMEMBERED_ORDERS)
  }

  function forget(id: string): void {
    ids.value = unique([...ids.value, ...loadOrderIds()]).filter((known) => known !== id)
  }

  // And the other way round: a change made in another tab shows up here without a reload.
  function onStorage(event: StorageEvent): void {
    if (event.key === STORAGE_KEY || event.key === null) ids.value = loadOrderIds()
  }
  window.addEventListener('storage', onStorage)
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => {
      window.removeEventListener('storage', onStorage)
    })
  }

  // Side effect: keep the saved copy in step with the list.
  watch(ids, (value) => {
    saveOrderIds(value)
  })

  return { ids, isEmpty, remember, forget }
})
