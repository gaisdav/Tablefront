import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OrderTracking from '@/components/order/OrderTracking.vue'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { menuItems } from '@/mocks/fixtures'

const mounted: VueWrapper[] = []
function track(orderId: string, pollIntervalMs = 20) {
  const wrapper = mount(OrderTracking, {
    props: { orderId, pollIntervalMs },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

function placeDelivery() {
  const item = menuItems.find((candidate) => candidate.available)
  if (item === undefined) throw new Error('no dish')
  return db.createOrder({
    lines: [{ menuItemId: item.id, name: item.name, unitPriceCents: item.priceCents, quantity: 1 }],
    fulfillment: 'delivery',
    customer: { name: 'Anna', phone: '+49 30 1234567', address: 'Hauptstr. 1, Berlin' },
  })
}

function placeOrder() {
  const item = menuItems.find((candidate) => candidate.available)
  if (item === undefined) throw new Error('no dish')
  return db.createOrder({
    lines: [{ menuItemId: item.id, name: item.name, unitPriceCents: item.priceCents, quantity: 2 }],
    fulfillment: 'pickup',
    customer: { name: 'Anna', phone: '+49 30 1234567' },
  })
}

const heading = (wrapper: VueWrapper) => wrapper.get('h1').text()
const stepsCurrent = (wrapper: VueWrapper) => wrapper.get('[aria-current="step"]').text()

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('OrderTracking', () => {
  it('shows the order, its progress and its items', async () => {
    const order = placeOrder()
    const wrapper = track(order.id)

    await vi.waitFor(() => {
      expect(wrapper.find('article').exists()).toBe(true)
    })

    expect(heading(wrapper)).toBe('Received')
    expect(stepsCurrent(wrapper)).toContain('Received')
    expect(wrapper.text()).toContain(order.id)
    expect(wrapper.text()).toContain('Pickup at the restaurant')
    expect(wrapper.text()).toContain('2×')
  })

  it('shows a delivery with a step for the courier, and follows it onto the road', async () => {
    const order = placeDelivery()
    db.setOrderStatus(order.id, 'ready')
    const wrapper = track(order.id)
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Ready')
    })
    expect(wrapper.findAll('li.step').map((step) => step.get('.step__label').text())).toEqual([
      'Received',
      'Preparing',
      'Ready',
      'On the way',
      'Completed',
    ])

    db.setOrderStatus(order.id, 'out_for_delivery')
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('On the way')
    })

    expect(stepsCurrent(wrapper)).toContain('On the way')
    expect(wrapper.get('p.visually-hidden[role="status"]').text()).toBe('Order status: On the way.')
  })

  it('keeps asking while the order is on the way, and stops once it is completed', async () => {
    const order = placeDelivery()
    db.setOrderStatus(order.id, 'out_for_delivery')
    const wrapper = track(order.id)
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('On the way')
    })
    expect(wrapper.text()).toContain('This page updates by itself')

    db.setOrderStatus(order.id, 'completed')
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Completed')
    })
    expect(wrapper.text()).not.toContain('This page updates by itself')
  })

  it('follows the order as the kitchen moves it along, and announces each change', async () => {
    const order = placeOrder()
    const wrapper = track(order.id)
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Received')
    })

    db.setOrderStatus(order.id, 'preparing')
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Preparing')
    })

    expect(stepsCurrent(wrapper)).toContain('Preparing')
    expect(wrapper.get('p.visually-hidden[role="status"]').text()).toBe('Order status: Preparing.')
  })

  it('stops asking once the order is completed', async () => {
    const order = placeOrder()
    db.setOrderStatus(order.id, 'completed')
    let requests = 0
    server.use(
      mswHttp.get('/api/orders/:id', () => {
        requests += 1
        return undefined
      }),
    )
    const wrapper = track(order.id)
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Completed')
    })

    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(requests).toBe(1)
    expect(wrapper.text()).not.toContain('updates by itself')
  })

  it('shows a cancelled order as cancelled, not as a stalled stepper', async () => {
    const order = placeOrder()
    db.setOrderStatus(order.id, 'cancelled')
    const wrapper = track(order.id)

    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Order cancelled')
    })

    expect(wrapper.find('.stepper').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('cancelled')
  })

  it('says so when the order does not exist, and does not keep asking', async () => {
    let requests = 0
    server.use(
      mswHttp.get('/api/orders/:id', () => {
        requests += 1
        return undefined
      }),
    )
    const wrapper = track('ord-missing')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text()).toContain('not found')
    })
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(requests).toBe(1)
  })

  it('keeps the page and tells the user when a refresh fails, then recovers', async () => {
    const order = placeOrder()
    const wrapper = track(order.id)
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Received')
    })

    server.use(
      mswHttp.get('/api/orders/:id', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Could not refresh the status')
    })
    expect(heading(wrapper)).toBe('Received')

    server.resetHandlers()
    db.setOrderStatus(order.id, 'ready')
    await vi.waitFor(
      () => {
        expect(heading(wrapper)).toBe('Ready')
      },
      { timeout: 2000 },
    )
    expect(wrapper.text()).not.toContain('Could not refresh')
  })

  it.each([408, 429])('keeps trying after a %i, which is temporary', async (status) => {
    const order = placeOrder()
    let first = true
    server.use(
      mswHttp.get('/api/orders/:id', () => {
        if (!first) return undefined
        first = false
        return HttpResponse.json({ error: { code: 'busy', message: 'Slow down' } }, { status })
      }),
    )
    const wrapper = track(order.id)

    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Received')
    })
  })

  it('does not promise a retry once polling has ended, and offers one', async () => {
    const order = placeOrder()
    const wrapper = track(order.id)
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Received')
    })

    server.use(
      mswHttp.get('/api/orders/:id', () =>
        HttpResponse.json({ error: { code: 'not_found', message: 'Gone' } }, { status: 404 }),
      ),
    )
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('can no longer be refreshed')
    })
    expect(wrapper.text()).not.toContain('trying again shortly')

    server.resetHandlers()
    db.setOrderStatus(order.id, 'preparing')
    await wrapper.get('.order__stale button').trigger('click')
    await vi.waitFor(() => {
      expect(heading(wrapper)).toBe('Preparing')
    })
    expect(wrapper.text()).not.toContain('can no longer be refreshed')
  })

  it('stops requesting when it is removed from the page', async () => {
    const order = placeOrder()
    let requests = 0
    server.use(
      mswHttp.get('/api/orders/:id', () => {
        requests += 1
        return undefined
      }),
    )
    const wrapper = track(order.id)
    await vi.waitFor(() => {
      expect(requests).toBeGreaterThan(1)
    })

    wrapper.unmount()
    await flushPromises()
    const after = requests
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(requests).toBe(after)
  })
})
