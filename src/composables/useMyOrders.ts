import { watch } from 'vue'
import { isApiError } from '@/api/errors'
import { ordersApi } from '@/api/ordersApi'
import { usePolling, type Polling } from '@/composables/usePolling'
import { isTerminalStatus } from '@/domain/orderStatus'
import type { Order } from '@/types/domain'

/** What the page knows about one remembered order. */
export type OrderEntry =
  /** `stale`: the last refresh of this one failed, so this is what was last known. */
  | { id: string; kind: 'order'; order: Order; stale?: boolean }
  /** The server says there is no such order (the mock backend restarted, or the id was made up). */
  | { id: string; kind: 'missing' }
  /** This one could not be loaded right now, while others could. */
  | { id: string; kind: 'unavailable' }

/** Nothing about this entry can change any more, so it never needs asking about again. */
export function isSettled(entry: OrderEntry): boolean {
  return (
    entry.kind === 'missing' || (entry.kind === 'order' && isTerminalStatus(entry.order.status))
  )
}

/**
 * Keeps the state of the remembered orders fresh. Only orders that can still change are asked
 * about again, and polling ends by itself once every one of them has settled.
 *
 * One order failing does not hide the others: it is shown as unavailable (or as the last thing
 * known about it). Only when every request fails is the whole refresh an error, which is what
 * makes the poller back off instead of hammering a server that is down.
 */
export function useMyOrders(
  ids: () => readonly string[],
  intervalMs = 10_000,
): Polling<OrderEntry[]> {
  const settled = new Map<string, OrderEntry>()
  const latest = new Map<string, OrderEntry>()

  const polling = usePolling(
    async (signal) => {
      const failures: unknown[] = []
      let attempted = 0

      const entries = await Promise.all(
        ids().map(async (id): Promise<OrderEntry> => {
          const known = settled.get(id)
          if (known !== undefined) return known

          attempted += 1
          try {
            const entry: OrderEntry = {
              id,
              kind: 'order',
              order: await ordersApi.getOrder(id, signal),
            }
            latest.set(id, entry)
            if (isSettled(entry)) settled.set(id, entry)
            return entry
          } catch (error) {
            // Cancelled (the page went away, or a newer refresh replaced this one): not a failure.
            if (signal.aborted) throw error
            if (isApiError(error) && error.status === 404) {
              const entry: OrderEntry = { id, kind: 'missing' }
              settled.set(id, entry)
              return entry
            }
            failures.push(error)
            const last = latest.get(id)
            return last?.kind === 'order' ? { ...last, stale: true } : { id, kind: 'unavailable' }
          }
        }),
      )

      const [firstFailure] = failures
      if (attempted > 0 && failures.length === attempted) {
        throw firstFailure instanceof Error ? firstFailure : new Error('Could not load your orders')
      }
      return entries
    },
    { intervalMs, shouldStop: (entries) => entries.every(isSettled) },
  )

  // The list can change while the page is open (another tab placed an order, one was forgotten).
  watch(
    () => [...ids()],
    (now, before) => {
      for (const known of [settled, latest]) {
        for (const id of known.keys()) if (!now.includes(id)) known.delete(id)
      }
      // A newcomer must be asked about, even if polling had already ended.
      if (now.some((id) => !before.includes(id))) polling.refresh()
    },
  )

  return polling
}
