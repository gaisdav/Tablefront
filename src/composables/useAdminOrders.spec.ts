import { createPinia, setActivePinia } from 'pinia'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { isOrderStatus, isRecord } from '@/domain/guards'
import { useAdminOrders } from '@/composables/useAdminOrders'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { signInAsAdmin } from '@/test/helpers'
import { useToastsStore } from '@/stores/toasts'
import type { OrderStatus } from '@/types/domain'

const scopes: EffectScope[] = []

function board(intervalMs = 20) {
  setActivePinia(createPinia())
  const scope = effectScope()
  scopes.push(scope)
  const result = scope.run(() => useAdminOrders(intervalMs))
  if (result === undefined) throw new Error('scope did not run')
  return { ...result, toasts: useToastsStore() }
}

const statusOf = (orders: ReturnType<typeof board>['orders'], id: string) =>
  orders.value?.find((order) => order.id === id)?.status

/** An order the board can move: the first one that is new. */
function aNewOrder() {
  const order = db.listOrders('new')[0]
  if (order === undefined) throw new Error('no new order in the fixtures')
  return order
}

async function loaded(result: ReturnType<typeof board>) {
  await vi.waitFor(() => {
    expect(result.orders.value).toBeDefined()
  })
}

beforeEach(async () => {
  await signInAsAdmin()
})

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

describe('useAdminOrders: moves that cannot be made', () => {
  it('does not even ask the server to send a pickup out for delivery', async () => {
    const requests = vi.fn()
    const onRequest = ({ request }: { request: Request }) => {
      if (request.method === 'PATCH') requests()
    }
    server.events.on('request:start', onRequest)
    onTestFinished(() => {
      server.events.removeListener('request:start', onRequest)
    })
    const result = board()
    await loaded(result)
    const pickup = db.listOrders('ready').find((order) => order.fulfillment === 'pickup')
    if (pickup === undefined) throw new Error('no ready pickup in the fixtures')

    await result.changeStatus(pickup.id, 'out_for_delivery')

    expect(requests).not.toHaveBeenCalled()
    expect(statusOf(result.orders, pickup.id)).toBe('ready')
  })

  it('lets a delivery that is ready go out for delivery', async () => {
    const result = board()
    await loaded(result)
    db.setOrderStatus('ord-1004', 'ready')
    await vi.waitFor(() => {
      expect(statusOf(result.orders, 'ord-1004')).toBe('ready') // picked up by the next refresh
    })

    await result.changeStatus('ord-1004', 'out_for_delivery')

    expect(statusOf(result.orders, 'ord-1004')).toBe('out_for_delivery')
    expect(db.getOrder('ord-1004')?.status).toBe('out_for_delivery')
  })
})

describe('useAdminOrders: loading', () => {
  it('loads every order, newest first', async () => {
    const result = board()

    await loaded(result)

    expect(result.orders.value?.map((order) => order.id)).toEqual(db.listOrders().map((o) => o.id))
  })

  it('picks up orders that arrive later', async () => {
    const result = board()
    await loaded(result)
    const before = result.orders.value?.length ?? 0

    db.createOrder({
      lines: [
        { menuItemId: 'item-5', name: 'Margherita pizza', unitPriceCents: 1100, quantity: 1 },
      ],
      fulfillment: 'pickup',
      customer: { name: 'Anna', phone: '+49 30 1234567' },
    })

    await vi.waitFor(() => {
      expect(result.orders.value).toHaveLength(before + 1)
    })
  })

  it('stops asking when the server says the session is over', async () => {
    let requests = 0
    server.use(
      mswHttp.get('/api/admin/orders', () => {
        requests += 1
        return HttpResponse.json(
          { error: { code: 'unauthorized', message: 'No' } },
          { status: 401 },
        )
      }),
    )
    const result = board()

    await vi.waitFor(() => {
      expect(result.polling.isStopped.value).toBe(true)
    })
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(requests).toBe(1)
  })
})

describe('useAdminOrders: changing a status', () => {
  it('shows the new status at once, before the server has answered', async () => {
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', async () => {
        await delay(80)
        return undefined
      }),
    )
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()

    const saving = result.changeStatus(order.id, 'preparing')

    expect(statusOf(result.orders, order.id)).toBe('preparing')
    expect(result.isSaving(order.id)).toBe(true)
    await saving
    expect(result.isSaving(order.id)).toBe(false)
    expect(statusOf(result.orders, order.id)).toBe('preparing')
    expect(db.getOrder(order.id)?.status).toBe('preparing')
  })

  it('says it was done', async () => {
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()

    await result.changeStatus(order.id, 'preparing')

    expect(result.toasts.toasts).toMatchObject([
      { kind: 'info', message: `Order ${order.id} is now preparing.` },
    ])
  })

  it('puts the old status back and says why when the server refuses (409)', async () => {
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()
    // Someone else completed it first; the server will refuse the move.
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', () =>
        HttpResponse.json(
          { error: { code: 'invalid_transition', message: 'Cannot change from new to preparing' } },
          { status: 409 },
        ),
      ),
    )

    const saving = result.changeStatus(order.id, 'preparing')
    expect(statusOf(result.orders, order.id)).toBe('preparing')
    await saving

    expect(statusOf(result.orders, order.id)).toBe('new')
    const [toast] = result.toasts.toasts
    expect(toast?.kind).toBe('error')
    expect(toast?.message).toContain('Cannot change from new to preparing')
  })

  it('asks the server what the order looks like after a conflict', async () => {
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()
    db.setOrderStatus(order.id, 'cancelled') // changed behind our back
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', () =>
        HttpResponse.json(
          { error: { code: 'invalid_transition', message: 'No' } },
          { status: 409 },
        ),
      ),
    )

    await result.changeStatus(order.id, 'preparing')

    await vi.waitFor(() => {
      expect(statusOf(result.orders, order.id)).toBe('cancelled')
    })
  })

  it('puts the old status back when the network fails', async () => {
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()
    server.use(mswHttp.patch('/api/admin/orders/:id/status', () => HttpResponse.error()))

    await result.changeStatus(order.id, 'preparing')

    expect(statusOf(result.orders, order.id)).toBe('new')
    expect(result.toasts.toasts[0]?.kind).toBe('error')
  })

  it('stays quiet about a 401: the user is already being taken to the login page', async () => {
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', () =>
        HttpResponse.json({ error: { code: 'unauthorized', message: 'No' } }, { status: 401 }),
      ),
    )

    await result.changeStatus(order.id, 'preparing')

    expect(statusOf(result.orders, order.id)).toBe('new')
    expect(result.toasts.toasts).toEqual([])
  })

  it('ignores a move the order cannot make, without asking the server', async () => {
    let requests = 0
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', () => {
        requests += 1
        return undefined
      }),
    )
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()

    await result.changeStatus(order.id, 'completed') // new -> completed is not allowed
    await result.changeStatus('ord-missing', 'preparing')

    expect(requests).toBe(0)
    expect(statusOf(result.orders, order.id)).toBe('new')
    expect(result.toasts.toasts).toEqual([])
  })

  it('does not send a second change for an order while one is on its way', async () => {
    const seen: OrderStatus[] = []
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', async ({ request }) => {
        const body: unknown = await request.clone().json()
        const status = isRecord(body) ? body.status : undefined
        if (isOrderStatus(status)) seen.push(status)
        await delay(60)
        return undefined
      }),
    )
    const result = board(10_000)
    await loaded(result)
    const order = aNewOrder()

    const first = result.changeStatus(order.id, 'preparing')
    await result.changeStatus(order.id, 'ready')
    await first

    expect(seen).toEqual(['preparing'])
    expect(statusOf(result.orders, order.id)).toBe('preparing')
  })

  it('lets two different orders be changed at the same time', async () => {
    const result = board(10_000)
    await loaded(result)
    const [first, second] = db.listOrders('new')
    if (first === undefined || second === undefined) throw new Error('need two new orders')

    await Promise.all([
      result.changeStatus(first.id, 'preparing'),
      result.changeStatus(second.id, 'cancelled'),
    ])

    expect(statusOf(result.orders, first.id)).toBe('preparing')
    expect(statusOf(result.orders, second.id)).toBe('cancelled')
  })
})

describe('useAdminOrders: a refresh that started before the change was saved', () => {
  it('does not flip the order back when its slow answer arrives after the change', async () => {
    const order = aNewOrder()
    let armed = false
    let started = false
    let landed = false
    server.use(
      mswHttp.get('/api/admin/orders', async () => {
        if (!armed) return undefined
        armed = false
        started = true
        // What the server said *before* the change, delivered late: this refresh began first.
        const stale = db.listOrders().map((o) => (o.id === order.id ? { ...o, status: 'new' } : o))
        await delay(100)
        landed = true
        return HttpResponse.json(stale)
      }),
    )
    const result = board(150)
    await loaded(result)
    armed = true
    await vi.waitFor(() => {
      expect(started).toBe(true)
    })

    await result.changeStatus(order.id, 'preparing')
    await vi.waitFor(() => {
      expect(landed).toBe(true)
    })
    await new Promise((resolve) => setTimeout(resolve, 15)) // let the answer be applied

    expect(statusOf(result.orders, order.id)).toBe('preparing')
  })

  it('shows what the server says once a refresh that began afterwards has answered', async () => {
    const result = board(15)
    await loaded(result)
    const order = aNewOrder()

    await result.changeStatus(order.id, 'preparing')
    db.setOrderStatus(order.id, 'ready') // the kitchen moved on

    await vi.waitFor(() => {
      expect(statusOf(result.orders, order.id)).toBe('ready')
    })
  })
})
