import { computed, reactive } from 'vue'
import { isApiError } from '@/api/errors'
import { adminApi } from '@/api/adminApi'
import { usePolling } from '@/composables/usePolling'
import { canTransition, statusLabel } from '@/domain/orderStatus'
import { useToastsStore } from '@/stores/toasts'
import type { Order, OrderStatus } from '@/types/domain'

export const ADMIN_POLL_INTERVAL_MS = 8000

/**
 * A change the user made that the screen already shows, before the server has agreed (or while it
 * is still the only copy of the truth, until a refresh that began later confirms it).
 */
interface Pending {
  status: OrderStatus
  /**
   * `null` while the request is in flight. Afterwards the number of the newest refresh that had
   * started when the server answered: only a refresh numbered higher began after the change was
   * saved, so only it can be trusted to show the saved state.
   */
  settledAfterRefresh: number | null
}

/**
 * The orders board: all orders, kept fresh, with status changes applied at once and undone if the
 * server refuses.
 *
 * Two races are handled on purpose:
 * - a refresh that began before the change was saved, and answers after, still carries the old
 *   status; it must not flip the screen back (hence `settledAfterRefresh`);
 * - the same order cannot be changed again while a change to it is in flight, so changes to one
 *   order reach the server in the order the user made them.
 */
export function useAdminOrders(intervalMs = ADMIN_POLL_INTERVAL_MS) {
  const toasts = useToastsStore()
  const pending = reactive(new Map<string, Pending>())
  let refreshesStarted = 0

  const polling = usePolling(
    async (signal) => {
      const number = ++refreshesStarted
      const orders = await adminApi.listOrders({}, signal)
      for (const [id, change] of pending) {
        if (change.settledAfterRefresh !== null && number > change.settledAfterRefresh) {
          pending.delete(id)
        }
      }
      return orders
    },
    {
      intervalMs,
      // Signed out or forbidden: retrying will not help (the 401 handler takes the user away).
      isFatal: (error) =>
        isApiError(error) &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 429].includes(error.status),
    },
  )

  /** The orders as the user should see them: the server's, with changes in progress applied. */
  const orders = computed<Order[] | undefined>(() =>
    polling.data.value?.map((order) => {
      const change = pending.get(order.id)
      return change === undefined ? order : { ...order, status: change.status }
    }),
  )

  function isSaving(id: string): boolean {
    return pending.get(id)?.settledAfterRefresh === null
  }

  async function changeStatus(id: string, status: OrderStatus): Promise<void> {
    const current = orders.value?.find((order) => order.id === id)
    if (current === undefined || isSaving(id) || !canTransition(current.status, status)) return

    pending.set(id, { status, settledAfterRefresh: null })
    try {
      await adminApi.updateOrderStatus(id, status)
      pending.set(id, { status, settledAfterRefresh: refreshesStarted })
      toasts.info(`Order ${id} is now ${statusLabel(status).toLowerCase()}.`)
    } catch (error) {
      pending.delete(id) // back to what the server last said
      // A 401 is already being handled (the user is taken to the login page).
      if (!(isApiError(error) && error.status === 401)) {
        const reason = isApiError(error) ? error.message : 'Something went wrong.'
        toasts.error(
          `Order ${id} was not changed to ${statusLabel(status).toLowerCase()}. ${reason}`,
        )
      }
      // The server disagreed about what the order looks like; find out what it does.
      if (isApiError(error) && (error.status === 409 || error.status === 404)) polling.refresh()
    }
  }

  return { orders, polling, isSaving, changeStatus }
}
