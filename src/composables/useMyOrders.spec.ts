import { effectScope, reactive, type EffectScope } from 'vue'
import { http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSettled, useMyOrders, type OrderEntry } from '@/composables/useMyOrders'
import { db } from '@/mocks/db'
import { menuItems } from '@/mocks/fixtures'
import { server } from '@/mocks/server'

const scopes: EffectScope[] = []

function track(ids: string[], intervalMs = 20) {
  const scope = effectScope()
  scopes.push(scope)
  const polling = scope.run(() => useMyOrders(() => ids, intervalMs))
  if (polling === undefined) throw new Error('scope did not run')
  return polling
}

function place() {
  const item = menuItems.find((candidate) => candidate.available)
  if (item === undefined) throw new Error('no dish')
  return db.createOrder({
    lines: [{ menuItemId: item.id, name: item.name, unitPriceCents: item.priceCents, quantity: 1 }],
    fulfillment: 'pickup',
    customer: { name: 'Anna', phone: '+49 30 1234567' },
  })
}

/** Counts requests per order id and lets them through. */
function countRequests() {
  const counts = new Map<string, number>()
  server.use(
    mswHttp.get('/api/orders/:id', ({ params }) => {
      const id = String(params.id)
      counts.set(id, (counts.get(id) ?? 0) + 1)
      return undefined
    }),
  )
  return counts
}

const kinds = (entries: OrderEntry[] | undefined) => entries?.map((entry) => entry.kind)

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

describe('useMyOrders: the list changes while it runs', () => {
  it('asks about an order added after polling had ended, and restarts', async () => {
    const [done, later] = [place(), place()]
    db.setOrderStatus(done.id, 'completed')
    const ids = reactive([done.id])
    const scope = effectScope()
    scopes.push(scope)
    const polling = scope.run(() => useMyOrders(() => ids, 20))
    if (polling === undefined) throw new Error('scope did not run')
    await vi.waitFor(() => {
      expect(polling.isStopped.value).toBe(true)
    })

    ids.unshift(later.id)

    await vi.waitFor(() => {
      expect(polling.data.value?.map((entry) => entry.id)).toEqual([later.id, done.id])
    })
    expect(polling.isStopped.value).toBe(false)
  })

  it('forgets what it knew about an order that was removed, so an id used again is asked about', async () => {
    const order = place()
    db.setOrderStatus(order.id, 'completed')
    const counts = countRequests()
    const ids = reactive([order.id])
    const scope = effectScope()
    scopes.push(scope)
    const polling = scope.run(() => useMyOrders(() => ids, 20))
    await vi.waitFor(() => {
      expect(polling?.isStopped.value).toBe(true)
    })

    ids.splice(0, 1)
    await new Promise((resolve) => setTimeout(resolve, 30))
    ids.push(order.id)

    await vi.waitFor(() => {
      expect(counts.get(order.id)).toBe(2)
    })
  })
})

describe('useMyOrders', () => {
  it('loads every remembered order, in the order of the ids', async () => {
    const [first, second] = [place(), place()]
    const polling = track([second.id, first.id])

    await vi.waitFor(() => {
      expect(polling.data.value).toHaveLength(2)
    })

    expect(polling.data.value?.map((entry) => entry.id)).toEqual([second.id, first.id])
  })

  it('has nothing to do, and stops, when nothing is remembered', async () => {
    const polling = track([])

    await vi.waitFor(() => {
      expect(polling.isStopped.value).toBe(true)
    })

    expect(polling.data.value).toEqual([])
  })

  it('follows an order that is still changing', async () => {
    const order = place()
    const polling = track([order.id])
    await vi.waitFor(() => {
      expect(polling.data.value).toHaveLength(1)
    })

    db.setOrderStatus(order.id, 'preparing')

    await vi.waitFor(() => {
      const [entry] = polling.data.value ?? []
      expect(entry?.kind === 'order' && entry.order.status).toBe('preparing')
    })
  })

  it('stops asking about an order once it is over, and ends when all of them are', async () => {
    const [done, running] = [place(), place()]
    db.setOrderStatus(done.id, 'completed')
    const counts = countRequests()
    const polling = track([done.id, running.id])

    await vi.waitFor(() => {
      expect(counts.get(running.id)).toBeGreaterThan(2)
    })
    expect(counts.get(done.id)).toBe(1)
    expect(polling.isStopped.value).toBe(false)

    db.setOrderStatus(running.id, 'cancelled')
    await vi.waitFor(() => {
      expect(polling.isStopped.value).toBe(true)
    })
    const after = counts.get(running.id)
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(counts.get(running.id)).toBe(after)
  })

  it('reports an order the server does not know as missing, and does not ask again', async () => {
    const known = place()
    const counts = countRequests()
    const polling = track(['ord-gone', known.id])
    await vi.waitFor(() => {
      expect(polling.data.value).toHaveLength(2)
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(kinds(polling.data.value)).toEqual(['missing', 'order'])
    expect(counts.get('ord-gone')).toBe(1)
  })

  it('shows one failing order as unavailable without hiding the others', async () => {
    const [good, bad] = [place(), place()]
    server.use(
      mswHttp.get('/api/orders/:id', ({ params }) =>
        params.id === bad.id
          ? HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 })
          : undefined,
      ),
    )
    const polling = track([good.id, bad.id])

    await vi.waitFor(() => {
      expect(kinds(polling.data.value)).toEqual(['order', 'unavailable'])
    })

    expect(polling.error.value).toBeNull()
    // Not settled: it is asked about again.
    expect(isSettled(polling.data.value?.[1] ?? { id: '', kind: 'missing' })).toBe(false)
    expect(polling.isStopped.value).toBe(false)
  })

  it('keeps what it last knew about an order when a refresh of it fails', async () => {
    const [first, second] = [place(), place()]
    const polling = track([first.id, second.id])
    await vi.waitFor(() => {
      expect(kinds(polling.data.value)).toEqual(['order', 'order'])
    })

    server.use(
      mswHttp.get('/api/orders/:id', ({ params }) =>
        params.id === first.id
          ? HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 })
          : undefined,
      ),
    )
    db.setOrderStatus(second.id, 'preparing')

    await vi.waitFor(() => {
      const [, entry] = polling.data.value ?? []
      expect(entry?.kind === 'order' && entry.order.status).toBe('preparing')
    })
    expect(kinds(polling.data.value)).toEqual(['order', 'order'])
  })

  it('marks an order as stale when a refresh of it fails after it had loaded', async () => {
    const [first, second] = [place(), place()]
    const polling = track([first.id, second.id])
    await vi.waitFor(() => {
      expect(kinds(polling.data.value)).toEqual(['order', 'order'])
    })

    server.use(
      mswHttp.get('/api/orders/:id', ({ params }) =>
        params.id === first.id
          ? HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 })
          : undefined,
      ),
    )

    await vi.waitFor(() => {
      const [entry, other] = polling.data.value ?? []
      expect(entry?.kind === 'order' && entry.stale).toBe(true)
      expect(other?.kind === 'order' && other.stale).toBeFalsy()
    })

    server.resetHandlers()
    await vi.waitFor(() => {
      const [entry] = polling.data.value ?? []
      expect(entry?.kind === 'order' && entry.stale).toBeFalsy()
    })
  })

  it('treats it as an error when every request fails, so the poller backs off', async () => {
    const order = place()
    server.use(
      mswHttp.get('/api/orders/:id', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    const polling = track([order.id])

    await vi.waitFor(() => {
      expect(polling.error.value?.message).toBe('Down')
    })

    expect(polling.data.value).toBeUndefined()
  })
})
