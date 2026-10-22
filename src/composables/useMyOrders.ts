import { isApiError } from '@/api/errors'
import { ordersApi } from '@/api/ordersApi'
import { usePolling, type Polling } from '@/composables/usePolling'
import { isTerminalStatus } from '@/domain/orderStatus'
import type { Order } from '@/types/domain'

/** What the page knows about one remembered order. */
export type OrderEntry =
  | { id: string; kind: 'order'; order: Order }
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

  return usePolling(
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
            if (isApiError(error) && error.status === 404) {
              const entry: OrderEntry = { id, kind: 'missing' }
              settled.set(id, entry)
              return entry
            }
            failures.push(error)
            return latest.get(id) ?? { id, kind: 'unavailable' }
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
}
