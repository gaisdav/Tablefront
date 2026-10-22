import { type VueWrapper } from '@vue/test-utils'
import { http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/mocks/db'
import { menuItems } from '@/mocks/fixtures'
import { server } from '@/mocks/server'
import { mountAppAt, unmountApps } from '@/test/mountApp'
import type { OrderStatus } from '@/types/domain'

function place(status: OrderStatus = 'new', quantity = 1) {
  const dishes = menuItems.filter((candidate) => candidate.available).slice(0, 3)
  const order = db.createOrder({
    lines: dishes.map((item) => ({
      menuItemId: item.id,
      name: item.name,
      unitPriceCents: item.priceCents,
      quantity,
    })),
    fulfillment: 'pickup',
    customer: { name: 'Anna', phone: '+49 30 1234567' },
  })
  if (status !== 'new') db.setOrderStatus(order.id, status)
  return order
}

function remember(...ids: string[]): void {
  // Newest first, as the store keeps them.
  localStorage.setItem('tablefront:orders', JSON.stringify({ version: 1, ids }))
}

const cards = (wrapper: VueWrapper) => wrapper.findAll('article.card')
const titles = (wrapper: VueWrapper) => cards(wrapper).map((card) => card.get('h3').text())
const sectionHeadings = (wrapper: VueWrapper) => wrapper.findAll('h2').map((h) => h.text())

async function untilLoaded(wrapper: VueWrapper) {
  await vi.waitFor(() => {
    expect(
      cards(wrapper).length > 0 ||
        wrapper.find('.gone').exists() ||
        wrapper.find('[role="alert"]').exists(),
    ).toBe(true)
  })
}

afterEach(unmountApps)

describe('My orders', () => {
  it('invites the user to the menu when nothing has been ordered', async () => {
    const { wrapper, router } = await mountAppAt('/orders')

    expect(wrapper.text()).toContain('No orders yet')
    await wrapper.get('main button').trigger('click')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('menu')
    })
  })

  it('shows what is in progress first, then the earlier orders, each as a link to its page', async () => {
    const [old, running, done] = [place('completed'), place('preparing'), place('cancelled')]
    remember(done.id, running.id, old.id)
    const { wrapper } = await mountAppAt('/orders')
    await untilLoaded(wrapper)

    expect(sectionHeadings(wrapper)).toEqual(['In progress', 'Earlier'])
    expect(titles(wrapper)).toEqual([`Order ${running.id}`, `Order ${done.id}`, `Order ${old.id}`])
    expect(cards(wrapper)[0]?.get('a').attributes('href')).toBe(`/orders/${running.id}`)
  })

  it('keeps a delivery that is on its way among those in progress', async () => {
    const dish = menuItems.find((candidate) => candidate.available)
    if (dish === undefined) throw new Error('no dish')
    const onTheWay = db.createOrder({
      lines: [
        { menuItemId: dish.id, name: dish.name, unitPriceCents: dish.priceCents, quantity: 1 },
      ],
      fulfillment: 'delivery',
      customer: { name: 'Anna', phone: '+49 30 1234567', address: 'Hauptstr. 1, Berlin' },
    })
    db.setOrderStatus(onTheWay.id, 'out_for_delivery')
    const done = place('completed')
    remember(done.id, onTheWay.id)
    const { wrapper } = await mountAppAt('/orders')
    await untilLoaded(wrapper)

    expect(sectionHeadings(wrapper)).toEqual(['In progress', 'Earlier'])
    expect(titles(wrapper)).toEqual([`Order ${onTheWay.id}`, `Order ${done.id}`])
    expect(cards(wrapper)[0]?.text()).toContain('On the way')
  })

  it('describes an order: status, items, total and how it is collected', async () => {
    const order = place('ready', 2)
    remember(order.id)
    const { wrapper } = await mountAppAt('/orders')
    await untilLoaded(wrapper)

    const text = cards(wrapper)[0]?.text() ?? ''
    expect(text).toContain('Ready')
    expect(text).toContain('2× ')
    expect(text).toContain('and 1 more')
    expect(text).toContain('Pickup')
    expect(text).toMatch(/€\d+\.\d{2}/)
    expect(cards(wrapper)[0]?.get('time').attributes('datetime')).toBe(order.createdAt)
  })

  it('has no "in progress" heading when nothing is in progress', async () => {
    const order = place('completed')
    remember(order.id)
    const { wrapper } = await mountAppAt('/orders')
    await untilLoaded(wrapper)

    expect(sectionHeadings(wrapper)).toEqual(['Earlier'])
  })

  it('says so about an order that no longer exists, and lets the user remove it', async () => {
    const real = place('preparing')
    remember('ord-gone', real.id)
    const { wrapper } = await mountAppAt('/orders')
    await vi.waitFor(() => {
      expect(wrapper.find('.gone').exists()).toBe(true)
    })

    expect(wrapper.get('.gone').text()).toContain('Order ord-gone no longer exists')
    expect(titles(wrapper)).toEqual([`Order ${real.id}`])

    await wrapper.get('[aria-label="Remove order ord-gone from the list"]').trigger('click')

    expect(wrapper.find('.gone').exists()).toBe(false)
    expect(localStorage.getItem('tablefront:orders')).not.toContain('ord-gone')
  })

  it('keeps an order that could not be loaded among those in progress, without Remove', async () => {
    const [good, flaky] = [place('preparing'), place('preparing')]
    remember(flaky.id, good.id)
    server.use(
      mswHttp.get('/api/orders/:id', ({ params }) =>
        params.id === flaky.id
          ? HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 })
          : undefined,
      ),
    )
    const { wrapper } = await mountAppAt('/orders')
    await vi.waitFor(() => {
      expect(wrapper.find('.gone').exists()).toBe(true)
    })

    expect(sectionHeadings(wrapper)).toEqual(['In progress'])
    expect(wrapper.get('.gone').text()).toContain('could not be loaded right now')
    expect(wrapper.get('.gone a').attributes('href')).toBe(`/orders/${flaky.id}`)
    expect(wrapper.find('.gone button').exists()).toBe(false)
  })

  it('shows the error with a way to retry when nothing can be loaded', async () => {
    const order = place()
    remember(order.id)
    server.use(
      mswHttp.get('/api/orders/:id', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    const { wrapper } = await mountAppAt('/orders')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text()).toContain('Down')
    })

    server.resetHandlers()
    await wrapper.get('[role="alert"] button').trigger('click')
    await untilLoaded(wrapper)
    await vi.waitFor(() => {
      expect(cards(wrapper)).toHaveLength(1)
    })
  })

  it('ignores ids that are not valid in a damaged list and still works', async () => {
    const order = place()
    localStorage.setItem(
      'tablefront:orders',
      JSON.stringify({ version: 1, ids: [7, null, order.id] }),
    )
    const { wrapper } = await mountAppAt('/orders')
    await untilLoaded(wrapper)

    expect(titles(wrapper)).toEqual([`Order ${order.id}`])
  })
})

describe('getting to My orders', () => {
  it('has no header link until an order has been placed, then has one', async () => {
    const { wrapper, router } = await mountAppAt('/')
    expect(wrapper.find('nav a[href="/orders"]').exists()).toBe(false)

    const order = place()
    remember(order.id)
    const second = await mountAppAt('/')

    expect(second.wrapper.get('nav a[href="/orders"]').text()).toBe('Orders')
    expect(router.currentRoute.value.name).toBe('menu')
  })

  it('links back from an order page to someone who has orders', async () => {
    const order = place()
    remember(order.id)
    const { wrapper } = await mountAppAt(`/orders/${order.id}`)

    expect(wrapper.get('a.back').attributes('href')).toBe('/orders')
  })

  it('offers no way back to someone who followed a shared link and has no orders', async () => {
    const order = place()
    const { wrapper } = await mountAppAt(`/orders/${order.id}`)

    expect(wrapper.find('a.back').exists()).toBe(false)
  })
})
