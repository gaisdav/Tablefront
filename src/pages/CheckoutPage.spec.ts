import { type VueWrapper } from '@vue/test-utils'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { mountAppAt, unmountApps } from '@/test/mountApp'

const pizzaLine = {
  menuItemId: 'item-5',
  name: 'Margherita pizza',
  unitPriceCents: 1100,
  quantity: 2,
  note: 'Extra basil',
}

function seedCart(): void {
  localStorage.setItem('tablefront:cart', JSON.stringify({ version: 1, lines: [pizzaLine] }))
}

async function mountCheckout() {
  seedCart()
  return mountAppAt('/checkout')
}

const input = (wrapper: VueWrapper, name: string) =>
  wrapper.get<HTMLInputElement>(`input[name="${name}"]`)
const submit = (wrapper: VueWrapper) => wrapper.get('form').trigger('submit')
const errorTexts = (wrapper: VueWrapper) => wrapper.findAll('.field__error').map((e) => e.text())

async function fillValid(wrapper: VueWrapper) {
  await input(wrapper, 'name').setValue('Anna Keller')
  await input(wrapper, 'phone').setValue('+49 30 1234567')
}

/** Counts order requests and lets them through to the normal handler. */
function countOrderRequests(options: { wait?: number } = {}) {
  const seen: unknown[] = []
  server.use(
    mswHttp.post('/api/orders', async ({ request }) => {
      seen.push(await request.clone().json())
      if (options.wait !== undefined) await delay(options.wait)
      return undefined
    }),
  )
  return seen
}

afterEach(unmountApps)

describe('checkout: the page', () => {
  it('invites the user to the menu when the cart is empty', async () => {
    const { wrapper, router } = await mountAppAt('/checkout')

    expect(wrapper.text()).toContain('Your cart is empty')
    expect(wrapper.find('form').exists()).toBe(false)

    await wrapper.get('main button').trigger('click')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('menu')
    })
  })

  it('shows the order and its total, also on the button', async () => {
    const { wrapper } = await mountCheckout()

    expect(wrapper.get('.summary').text()).toContain('Margherita pizza')
    expect(wrapper.get('.summary').text()).toContain('Extra basil')
    expect(wrapper.get('.summary').text()).toContain('€22.00')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Place order · €22.00')
  })

  it('asks for an address only when the order is delivered', async () => {
    const { wrapper } = await mountCheckout()
    expect(wrapper.find('input[name="address"]').exists()).toBe(false)

    await wrapper.get('input[type="radio"][value="delivery"]').setValue()
    expect(wrapper.find('input[name="address"]').exists()).toBe(true)

    await wrapper.get('input[type="radio"][value="pickup"]').setValue()
    expect(wrapper.find('input[name="address"]').exists()).toBe(false)
  })
})

describe('checkout: validation', () => {
  it('shows every problem inline, focuses the first one, and sends nothing', async () => {
    const sent = countOrderRequests()
    const { wrapper } = await mountCheckout()
    await wrapper.get('input[type="radio"][value="delivery"]').setValue()

    await submit(wrapper)
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input(wrapper, 'name').element)
    })

    expect(errorTexts(wrapper)).toEqual([
      'Name is required',
      'Phone is required',
      'Address is required for delivery',
    ])
    expect(input(wrapper, 'name').attributes('aria-invalid')).toBe('true')
    expect(sent).toHaveLength(0)
  })

  it('focuses the first invalid field, not the first field', async () => {
    const { wrapper } = await mountCheckout()
    await input(wrapper, 'name').setValue('Anna')

    await submit(wrapper)

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input(wrapper, 'phone').element)
    })
  })

  it('rejects a phone number that cannot be one', async () => {
    const { wrapper } = await mountCheckout()
    await input(wrapper, 'name').setValue('Anna')
    await input(wrapper, 'phone').setValue('call me')

    await submit(wrapper)

    expect(errorTexts(wrapper)).toEqual(['Phone number looks invalid'])
  })

  it('does not nag before the first attempt, then clears each message as it is fixed', async () => {
    const { wrapper } = await mountCheckout()
    await input(wrapper, 'name').setValue('A')
    await input(wrapper, 'name').setValue('')
    expect(errorTexts(wrapper)).toEqual([])

    await submit(wrapper)
    expect(errorTexts(wrapper)).toHaveLength(2)

    await input(wrapper, 'name').setValue('Anna')
    expect(errorTexts(wrapper)).toEqual(['Phone is required'])

    await input(wrapper, 'phone').setValue('+49 30 1234567')
    expect(errorTexts(wrapper)).toEqual([])
  })

  it('drops the address error when the user switches to pickup', async () => {
    const { wrapper } = await mountCheckout()
    await wrapper.get('input[type="radio"][value="delivery"]').setValue()
    await submit(wrapper)
    expect(errorTexts(wrapper)).toContain('Address is required for delivery')

    await wrapper.get('input[type="radio"][value="pickup"]').setValue()

    expect(errorTexts(wrapper)).not.toContain('Address is required for delivery')
  })
})

describe('checkout: placing the order', () => {
  it('sends the order, clears the cart and opens the order page', async () => {
    const sent = countOrderRequests()
    const { wrapper, router, cart } = await mountCheckout()
    await fillValid(wrapper)
    await wrapper.get('input[type="radio"][value="delivery"]').setValue()
    await input(wrapper, 'address').setValue('Hauptstr. 1, Berlin')

    await submit(wrapper)
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('order')
    })

    expect(sent).toEqual([
      {
        fulfillment: 'delivery',
        customer: {
          name: 'Anna Keller',
          phone: '+49 30 1234567',
          address: 'Hauptstr. 1, Berlin',
        },
        lines: [{ menuItemId: 'item-5', quantity: 2, note: 'Extra basil' }],
      },
    ])
    const id = router.currentRoute.value.params.id
    expect(db.getOrder(String(id))?.customer.name).toBe('Anna Keller')
    expect(cart.isEmpty).toBe(true)
    expect(localStorage.getItem('tablefront:cart')).toContain('"lines":[]')
    await vi.waitFor(() => {
      expect(wrapper.find('.order').exists()).toBe(true)
    })
  })

  it('does not leave a checkout page behind in the history', async () => {
    const { wrapper, router } = await mountCheckout()
    await fillValid(wrapper)

    await submit(wrapper)
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('order')
    })
    router.back()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(router.currentRoute.value.name).toBe('order')
  })

  it('sends one order however many times it is submitted while waiting', async () => {
    const sent = countOrderRequests({ wait: 80 })
    const ordersBefore = db.listOrders().length
    const { wrapper, router } = await mountCheckout()
    await fillValid(wrapper)

    void submit(wrapper)
    void submit(wrapper)
    await wrapper.get('button[type="submit"]').trigger('click')
    await wrapper.get('button[type="submit"]').trigger('click')
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe('true')

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('order')
    })
    expect(sent).toHaveLength(1)
    expect(db.listOrders()).toHaveLength(ordersBefore + 1)
  })
})

describe('checkout: when the page cannot move on', () => {
  it('empties the cart and links to the order instead of inviting a second submit', async () => {
    const sent = countOrderRequests()
    const { wrapper, router, cart } = await mountCheckout()
    router.beforeEach((to) => to.name !== 'order')
    await fillValid(wrapper)

    await submit(wrapper)

    const placed = await vi.waitFor(() => wrapper.get('.placed'))
    expect(placed.text()).toContain('Your order has been placed')
    expect(placed.get('a').attributes('href')).toMatch(/^\/orders\/ord-/)
    expect(cart.isEmpty).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(sent).toHaveLength(1)
  })
})

describe('checkout: server errors', () => {
  function rejectWith(fields: Record<string, string>) {
    server.use(
      mswHttp.post('/api/orders', () =>
        HttpResponse.json(
          { error: { code: 'validation_failed', message: 'Invalid order', fields } },
          { status: 422 },
        ),
      ),
    )
  }

  it('puts a field error from the API on its input and focuses it', async () => {
    rejectWith({ 'customer.phone': 'Phone number looks invalid' })
    const { wrapper } = await mountCheckout()
    await fillValid(wrapper)

    await submit(wrapper)

    await vi.waitFor(() => {
      expect(errorTexts(wrapper)).toEqual(['Phone number looks invalid'])
    })
    expect(input(wrapper, 'phone').attributes('aria-invalid')).toBe('true')
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input(wrapper, 'phone').element)
    })
    expect(wrapper.find('.problems').exists()).toBe(false)
  })

  it('lists problems with the order itself in an alert that names the dish', async () => {
    rejectWith({ 'lines.0.quantity': 'Quantity must be between 1 and 99' })
    const { wrapper, router } = await mountCheckout()
    await fillValid(wrapper)

    await submit(wrapper)

    const alert = await vi.waitFor(() => wrapper.get('.problems'))
    expect(alert.text()).toContain('Margherita pizza: Quantity must be between 1 and 99')
    expect(router.currentRoute.value.name).toBe('checkout')
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(alert.element)
    })
  })

  it('focuses the alert when the server reports both a field and a line problem', async () => {
    rejectWith({
      'customer.phone': 'Phone number looks invalid',
      'lines.0.menuItemId': 'Margherita pizza is no longer available',
    })
    const { wrapper } = await mountCheckout()
    await fillValid(wrapper)

    await submit(wrapper)

    const alert = await vi.waitFor(() => wrapper.get('.problems'))
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(alert.element)
    })
    expect(errorTexts(wrapper)).toEqual(['Phone number looks invalid'])
  })

  it('lets the user correct a server error and send again', async () => {
    rejectWith({ 'customer.name': 'Name is not accepted' })
    const { wrapper, router } = await mountCheckout()
    await fillValid(wrapper)
    await submit(wrapper)
    await vi.waitFor(() => {
      expect(errorTexts(wrapper)).toEqual(['Name is not accepted'])
    })

    server.resetHandlers()
    await input(wrapper, 'name').setValue('Anna K.')
    expect(errorTexts(wrapper)).toEqual([])
    await submit(wrapper)

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('order')
    })
  })

  it('keeps what was typed and the cart when the request fails, and allows another try', async () => {
    server.use(
      mswHttp.post('/api/orders', () =>
        HttpResponse.json(
          { error: { code: 'server_error', message: 'Kitchen is down' } },
          { status: 500 },
        ),
      ),
    )
    const { wrapper, router, cart } = await mountCheckout()
    await fillValid(wrapper)

    await submit(wrapper)

    const alert = await vi.waitFor(() => wrapper.get('.problems'))
    expect(alert.text()).toContain('Kitchen is down')
    expect(input(wrapper, 'name').element.value).toBe('Anna Keller')
    expect(cart.itemCount).toBe(2)
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBeUndefined()

    server.resetHandlers()
    await submit(wrapper)
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('order')
    })
  })

  it('shows a generic message for an error that is not from the API', async () => {
    server.use(mswHttp.post('/api/orders', () => HttpResponse.error()))
    const { wrapper } = await mountCheckout()
    await fillValid(wrapper)

    await submit(wrapper)

    const alert = await vi.waitFor(() => wrapper.get('.problems'))
    expect(alert.text()).not.toBe('')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
