import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { startStaffSession } from '@/test/helpers'
import { setViewport } from '@/test/media'
import { mountAppAt, unmountApps } from '@/test/mountApp'

const rows = (wrapper: VueWrapper) => wrapper.findAll('button.row')
const rowIds = (wrapper: VueWrapper) => rows(wrapper).map((row) => row.get('.row__id').text())
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const chips = (wrapper: VueWrapper) => wrapper.findAll('.chip').map((chip) => chip.text())
const toastTexts = () => [...document.querySelectorAll('.toast__message')].map((t) => t.textContent)

async function mountBoard(path = '/admin/orders') {
  startStaffSession()
  const result = await mountAppAt(path)
  await vi.waitFor(() => {
    expect(rows(result.wrapper).length).toBeGreaterThan(0)
  })
  return result
}

/** The id of an order with the given status in the fixtures. */
function idWith(status: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled'): string {
  const order = db.listOrders(status)[0]
  if (order === undefined) throw new Error(`no ${status} order in the fixtures`)
  return order.id
}

/** Clicks a row and waits for the navigation that selecting it causes. */
async function choose(wrapper: VueWrapper, id: string): Promise<void> {
  await rowFor(wrapper, id).trigger('click')
  await flushPromises()
}

const rowFor = (wrapper: VueWrapper, id: string) => {
  const row = rows(wrapper).find((candidate) => candidate.get('.row__id').text() === id)
  if (row === undefined) throw new Error(`no row for ${id}`)
  return row
}

beforeEach(() => {
  setViewport(false)
})

afterEach(() => {
  unmountApps()
  setViewport(false)
})

describe('the orders board: the list', () => {
  it('lists every order, newest first', async () => {
    const { wrapper } = await mountBoard()

    expect(rowIds(wrapper)).toEqual(db.listOrders().map((order) => order.id))
  })

  it('offers a filter with a count for each status', async () => {
    const { wrapper } = await mountBoard()

    const all = db.listOrders()
    const count = (status: string) => all.filter((order) => order.status === status).length
    expect(chips(wrapper)).toEqual([
      `All (${String(all.length)})`,
      `Received (${String(count('new'))})`,
      `Preparing (${String(count('preparing'))})`,
      `Ready (${String(count('ready'))})`,
      `Completed (${String(count('completed'))})`,
      `Cancelled (${String(count('cancelled'))})`,
    ])
  })

  it('filters by status, and keeps the filter in the URL', async () => {
    const { wrapper, router } = await mountBoard()

    await wrapper.findAll('.chip input')[2]?.setValue()
    await flushPromises()

    expect(router.currentRoute.value.query.status).toBe('preparing')
    expect(rowIds(wrapper)).toEqual(db.listOrders('preparing').map((order) => order.id))
  })

  it('opens already filtered from a link, and ignores a status it does not know', async () => {
    const filtered = await mountBoard('/admin/orders?status=ready')
    expect(rowIds(filtered.wrapper)).toEqual(db.listOrders('ready').map((order) => order.id))

    const unknown = await mountBoard('/admin/orders?status=lost')
    expect(rowIds(unknown.wrapper)).toHaveLength(db.listOrders().length)
  })

  it('says so when no order has the chosen status', async () => {
    for (const order of db.listOrders('cancelled')) db.setOrderStatus(order.id, 'cancelled')
    const { wrapper } = await mountBoard()
    server.use(
      mswHttp.get('/api/admin/orders', () =>
        HttpResponse.json(db.listOrders().filter((order) => order.status !== 'cancelled')),
      ),
    )
    await wrapper.get('button.button').trigger('click') // refresh
    await flushPromises()

    await wrapper.findAll('.chip input')[5]?.setValue()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('No cancelled orders')
    })
  })

  it('says so when there are no orders at all', async () => {
    startStaffSession()
    server.use(mswHttp.get('/api/admin/orders', () => HttpResponse.json([])))
    const { wrapper } = await mountAppAt('/admin/orders')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('No orders yet')
    })
  })

  it('shows an error with a way to retry when the orders cannot be loaded', async () => {
    startStaffSession()
    server.use(
      mswHttp.get('/api/admin/orders', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    const { wrapper } = await mountAppAt('/admin/orders')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text()).toContain('Down')
    })

    server.resetHandlers()
    await wrapper.get('[role="alert"] button').trigger('click')
    await vi.waitFor(() => {
      expect(rows(wrapper).length).toBeGreaterThan(0)
    })
  })
})

describe('the orders board: details', () => {
  it('opens the details over the list on a narrow window, and closes them with Escape', async () => {
    const { wrapper, router } = await mountBoard()
    const id = idWith('new')

    await rowFor(wrapper, id).trigger('click')
    await vi.waitFor(() => {
      expect(dialog()).not.toBeNull()
    })

    expect(router.currentRoute.value.query.order).toBe(id)
    expect(dialog()?.textContent).toContain(`Order ${id}`)
    expect(rowFor(wrapper, id).attributes('aria-pressed')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => {
      expect(dialog()).toBeNull()
    })
    expect(router.currentRoute.value.query.order).toBeUndefined()
  })

  it('shows the details beside the list on a wide window, with no dialog', async () => {
    setViewport(true)
    const { wrapper } = await mountBoard()
    const id = idWith('new')
    expect(wrapper.get('aside.detail').text()).toContain('Select an order')

    await choose(wrapper, id)

    expect(dialog()).toBeNull()
    expect(wrapper.get('aside.detail').text()).toContain(`Order ${id}`)
  })

  it('opens the order named in the link', async () => {
    setViewport(true)
    const id = idWith('preparing')
    const { wrapper } = await mountBoard(`/admin/orders?order=${id}`)

    expect(wrapper.get('aside.detail h2').text()).toBe(`Order ${id}`)
    expect(rowFor(wrapper, id).attributes('aria-pressed')).toBe('true')
  })

  it('says so when the order in the link is not there', async () => {
    setViewport(true)
    const { wrapper } = await mountBoard('/admin/orders?order=ord-nope')

    expect(wrapper.get('aside.detail').text()).toContain('no longer in the list')
  })

  it('offers only the moves the order can make, and none for a finished one', async () => {
    setViewport(true)
    const { wrapper } = await mountBoard()

    await choose(wrapper, idWith('preparing'))
    expect(wrapper.findAll('aside.detail .actions button').map((b) => b.text())).toEqual([
      'Mark as ready',
      'Cancel order',
    ])

    await choose(wrapper, idWith('completed'))
    expect(wrapper.find('aside.detail .actions button').exists()).toBe(false)
  })
})

describe('the orders board: changing a status', () => {
  it('shows the change at once, in the list and in the details, then confirms it', async () => {
    setViewport(true)
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', async () => {
        await delay(80)
        return undefined
      }),
    )
    const { wrapper } = await mountBoard()
    const id = idWith('new')
    await choose(wrapper, id)

    await wrapper.findAll('aside.detail .actions button')[0]?.trigger('click')

    // Before the server has answered:
    expect(rowFor(wrapper, id).text()).toContain('Preparing')
    expect(wrapper.get('aside.detail').text()).toContain('Mark as ready')
    expect(db.getOrder(id)?.status).toBe('new')

    await vi.waitFor(() => {
      expect(toastTexts()).toContain(`Order ${id} is now preparing.`)
    })
    expect(db.getOrder(id)?.status).toBe('preparing')
    expect(rowFor(wrapper, id).text()).toContain('Preparing')
  })

  it('undoes the change and explains it when the server refuses', async () => {
    setViewport(true)
    server.use(
      mswHttp.patch('/api/admin/orders/:id/status', async () => {
        await delay(40)
        return HttpResponse.json(
          { error: { code: 'invalid_transition', message: 'Cannot change from new to preparing' } },
          { status: 409 },
        )
      }),
    )
    const { wrapper } = await mountBoard()
    const id = idWith('new')
    await choose(wrapper, id)

    await wrapper.findAll('aside.detail .actions button')[0]?.trigger('click')
    expect(rowFor(wrapper, id).text()).toContain('Preparing')

    await vi.waitFor(() => {
      expect(document.querySelector('.toast--error')?.textContent).toContain(
        'Cannot change from new to preparing',
      )
    })
    expect(rowFor(wrapper, id).text()).toContain('Received')
    expect(wrapper.findAll('aside.detail .actions button').map((b) => b.text())).toEqual([
      'Start preparing',
      'Cancel order',
    ])
  })

  it('undoes the change when the network fails', async () => {
    setViewport(true)
    server.use(mswHttp.patch('/api/admin/orders/:id/status', () => HttpResponse.error()))
    const { wrapper } = await mountBoard()
    const id = idWith('new')
    await choose(wrapper, id)

    await wrapper.findAll('aside.detail .actions button')[0]?.trigger('click')

    await vi.waitFor(() => {
      expect(document.querySelector('.toast--error')).not.toBeNull()
    })
    expect(rowFor(wrapper, id).text()).toContain('Received')
  })

  it('keeps focus in the details after the pressed button is replaced', async () => {
    setViewport(true)
    const { wrapper } = await mountBoard()
    const id = idWith('new')
    await choose(wrapper, id)
    const first = wrapper.findAll<HTMLElement>('aside.detail .actions button')[0]
    first?.element.focus()

    await first?.trigger('click')

    await vi.waitFor(() => {
      expect(document.activeElement?.textContent.trim()).toBe('Mark as ready')
    })
  })
})

describe('the orders board: staying up to date', () => {
  it('keeps the selected order and the very same rows when the list is refreshed', async () => {
    setViewport(true)
    const { wrapper, router } = await mountBoard()
    const id = idWith('new')
    await choose(wrapper, id)
    const before = rows(wrapper).map((row) => row.element)

    // The kitchen moves another order along, then the list refreshes.
    db.setOrderStatus(idWith('preparing'), 'ready')
    await wrapper.get('.board__head button').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.get('.board__head button').attributes('aria-busy')).toBeUndefined()
    })

    expect(router.currentRoute.value.query.order).toBe(id)
    expect(wrapper.get('aside.detail h2').text()).toBe(`Order ${id}`)
    // Same elements, not rebuilt ones: nothing jumps, and a scrolled list stays where it was.
    expect(rows(wrapper).map((row) => row.element)).toEqual(before)
  })

  it('keeps showing the orders and says so when a refresh fails', async () => {
    const { wrapper } = await mountBoard()
    server.use(
      mswHttp.get('/api/admin/orders', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )

    await wrapper.get('.board__head button').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Could not refresh the orders')
    })
    expect(rows(wrapper).length).toBeGreaterThan(0)
  })
})

describe('the admin shell', () => {
  it('signs out and goes to the login page', async () => {
    const { wrapper, router } = await mountBoard()

    const signOut = wrapper.findAll('button').find((button) => button.text() === 'Sign out')
    await signOut?.trigger('click')

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('admin-login')
    })
    expect(sessionStorage.getItem('tablefront:admin-token')).toBeNull()
  })

  it('announces what happened in a notifications region that is always there', async () => {
    const { wrapper } = await mountBoard()

    expect(
      wrapper.find('[role="region"][aria-label="Notifications"] [aria-live="polite"]').exists(),
    ).toBe(true)
  })
})
