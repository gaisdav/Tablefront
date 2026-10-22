import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { menuItems } from '@/mocks/fixtures'
import { server } from '@/mocks/server'
import { mountAppAt, unmountApps } from '@/test/mountApp'

const KEY = 'tablefront:cart'
const pizzaLine = {
  menuItemId: 'item-5',
  name: 'Margherita pizza',
  unitPriceCents: 1100,
  quantity: 2,
  note: '',
}

function seedCart(...lines: object[]) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, lines }))
}

const cartButton = (wrapper: VueWrapper) => wrapper.get('.cart-button')
const announcement = (wrapper: VueWrapper) => wrapper.get('p.visually-hidden[role="status"]').text()
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const inDialog = (label: string) => dialog()?.querySelector<HTMLElement>(`[aria-label="${label}"]`)
const button = (text: string) =>
  [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent.trim() === text,
  )

async function openCart(wrapper: VueWrapper) {
  await cartButton(wrapper).trigger('click')
  await vi.waitFor(() => {
    expect(dialog()).not.toBeNull()
  })
}

async function untilMenuLoaded(wrapper: VueWrapper) {
  await vi.waitFor(() => {
    expect(wrapper.find('.card').exists()).toBe(true)
  })
}

/** Makes the menu report a different price for one dish. */
function repriceDish(id: string, priceCents: number) {
  server.use(
    mswHttp.get('/api/menu-items', ({ request }) => {
      const hasFilters = new URL(request.url).searchParams.size > 0
      if (hasFilters) return undefined
      return HttpResponse.json(
        menuItems
          .filter((item) => item.available)
          .map((item) => (item.id === id ? { ...item, priceCents } : item)),
      )
    }),
  )
}

afterEach(unmountApps)

describe('cart from the menu', () => {
  it('starts empty', async () => {
    const { wrapper } = await mountAppAt('/')

    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, empty')
  })

  it('adds a dish: count, card hint and spoken announcement all follow', async () => {
    const { wrapper, cart } = await mountAppAt('/')
    await untilMenuLoaded(wrapper)

    await wrapper.get('[aria-label="Add Margherita pizza to cart"]').trigger('click')

    expect(cart.quantityOf('item-5')).toBe(1)
    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, 1 item')
    expect(wrapper.find('[aria-label="Add Margherita pizza to cart"]').exists()).toBe(false)
    expect(wrapper.get('.card [role="group"] .stepper__value').text()).toBe('1')
    expect(announcement(wrapper)).toBe('Added Margherita pizza. Cart total €11.00.')

    await wrapper.get('[aria-label="Increase quantity"]').trigger('click')

    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, 2 items')
    expect(announcement(wrapper)).toBe('Margherita pizza: 2 in cart. Cart total €22.00.')
  })

  it('re-announces an identical message by clearing the live region first', async () => {
    const { wrapper, cart } = await mountAppAt('/')
    await untilMenuLoaded(wrapper)
    const addButton = '[aria-label="Add Margherita pizza to cart"]'
    await wrapper.get(addButton).trigger('click')
    // The drawer is silent while open, so the region still holds "Added ..." after this.
    await openCart(wrapper)
    inDialog('Remove Margherita pizza from cart')?.click()
    await vi.waitFor(() => {
      expect(cart.isEmpty).toBe(true)
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => {
      expect(dialog()).toBeNull()
    })
    const seen: string[] = []
    const observer = new MutationObserver(() => {
      seen.push(announcement(wrapper))
    })
    observer.observe(wrapper.get('p.visually-hidden[role="status"]').element, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    await wrapper.get(addButton).trigger('click')
    await vi.waitFor(() => {
      expect(announcement(wrapper)).toBe('Added Margherita pizza. Cart total €11.00.')
    })
    observer.disconnect()

    expect(seen).toContain('')
  })

  it('turns Add into a stepper that adds, removes and goes back to Add', async () => {
    const { wrapper, cart } = await mountAppAt('/')
    await untilMenuLoaded(wrapper)
    const card = () => wrapper.findAll('.card').find((c) => c.text().includes('Margherita pizza'))
    // A real click focuses the button; jsdom's synthetic one does not.
    wrapper.get<HTMLElement>('[aria-label="Add Margherita pizza to cart"]').element.focus()
    await wrapper.get('[aria-label="Add Margherita pizza to cart"]').trigger('click')
    await flushPromises()
    // The button that was pressed is gone; focus carries on at the +.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Increase quantity')

    await card()?.get('[aria-label="Increase quantity"]').trigger('click')
    expect(cart.quantityOf('item-5')).toBe(2)
    await card()?.get('[aria-label="Decrease quantity"]').trigger('click')
    expect(cart.quantityOf('item-5')).toBe(1)
    card()?.get<HTMLElement>('[aria-label="Remove Margherita pizza from cart"]').element.focus()
    await card()?.get('[aria-label="Remove Margherita pizza from cart"]').trigger('click')

    await flushPromises()
    expect(cart.isEmpty).toBe(true)
    expect(wrapper.find('[aria-label="Add Margherita pizza to cart"]').exists()).toBe(true)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Add Margherita pizza to cart')
    expect(announcement(wrapper)).toBe('Removed Margherita pizza. Your cart is empty.')
  })

  it('offers no add button for a sold-out dish', async () => {
    const { wrapper } = await mountAppAt('/')
    await untilMenuLoaded(wrapper)

    expect(wrapper.find('[aria-label="Add Lasagna to cart"]').exists()).toBe(false)
  })
})

describe('cart drawer', () => {
  it('shows the lines and lets the user change quantity and remove a dish', async () => {
    seedCart(pizzaLine)
    const { wrapper, cart } = await mountAppAt('/checkout')

    await openCart(wrapper)
    expect(dialog()?.textContent).toContain('€22.00')

    inDialog('Increase quantity')?.click()
    await vi.waitFor(() => {
      expect(dialog()?.textContent).toContain('€33.00')
    })
    expect(cart.itemCount).toBe(3)

    inDialog('Remove Margherita pizza from cart')?.click()
    await vi.waitFor(() => {
      expect(dialog()?.textContent).toContain('Your cart is empty')
    })
    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, empty')
  })

  it('does not repeat announcements the drawer already makes itself', async () => {
    seedCart(pizzaLine)
    const { wrapper } = await mountAppAt('/checkout')
    await openCart(wrapper)

    inDialog('Increase quantity')?.click()
    await vi.waitFor(() => {
      expect(dialog()?.textContent).toContain('€33.00')
    })

    expect(announcement(wrapper)).toBe('')
  })

  it('keeps a note with its dish', async () => {
    seedCart(pizzaLine)
    const { wrapper, cart } = await mountAppAt('/checkout')
    await openCart(wrapper)

    const note = inDialog('Note for Margherita pizza')
    if (!(note instanceof HTMLInputElement)) throw new Error('note field not found')
    note.value = 'Extra basil'
    note.dispatchEvent(new Event('input', { bubbles: true }))

    expect(cart.lines[0]?.note).toBe('Extra basil')
  })

  it('goes to checkout and closes', async () => {
    seedCart(pizzaLine)
    const { wrapper, router } = await mountAppAt('/')
    await openCart(wrapper)

    button('Go to checkout')?.click()

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('checkout')
    })
    await vi.waitFor(() => {
      expect(dialog()).toBeNull()
    })
  })

  it('goes back to the menu from the empty cart', async () => {
    const { wrapper, router } = await mountAppAt('/checkout')
    await openCart(wrapper)

    button('Browse the menu')?.click()

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('menu')
    })
  })

  it('closes on Escape and gives focus back to the cart button', async () => {
    const { wrapper } = await mountAppAt('/checkout')
    const trigger = cartButton(wrapper).element
    if (!(trigger instanceof HTMLElement)) throw new Error('cart button not found')
    trigger.focus()
    await openCart(wrapper)

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    await vi.waitFor(() => {
      expect(dialog()).toBeNull()
    })
    expect(document.activeElement).toBe(trigger)
  })
})

describe('cart after a reload', () => {
  it('restores what was saved', async () => {
    seedCart(pizzaLine)

    const { wrapper } = await mountAppAt('/checkout')

    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, 2 items')
  })

  it('starts with an empty cart, without crashing, when the saved data is garbage', async () => {
    localStorage.setItem(KEY, '{"version":1,"lines":')

    const { wrapper } = await mountAppAt('/')

    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, empty')
    await untilMenuLoaded(wrapper)
  })
})

describe('cart reconciled with the menu', () => {
  it('removes a dish that sold out since it was saved, and tells the user', async () => {
    seedCart(pizzaLine, {
      ...pizzaLine,
      menuItemId: 'item-8',
      name: 'Lasagna',
      unitPriceCents: 1500,
      quantity: 1,
    })
    const { wrapper, cart } = await mountAppAt('/checkout')

    await vi.waitFor(() => {
      expect(cart.quantityOf('item-8')).toBe(0)
    })

    expect(cart.quantityOf('item-5')).toBe(2)
    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, 2 items, has changes')
    expect(announcement(wrapper)).toContain(
      'Lasagna is no longer available and was removed from your cart.',
    )

    await openCart(wrapper)
    expect(dialog()?.textContent).toContain('Lasagna is no longer available')
  })

  it('updates a price that changed since it was saved, and tells the user', async () => {
    seedCart({ ...pizzaLine, unitPriceCents: 900 })
    const { wrapper, cart } = await mountAppAt('/checkout')

    await vi.waitFor(() => {
      expect(cart.lines[0]?.unitPriceCents).toBe(1100)
    })
    await openCart(wrapper)

    expect(dialog()?.textContent).toContain('Margherita pizza now costs €11.00 (was €9.00).')
    expect(dialog()?.querySelector('.summary__total')?.textContent).toContain('€22.00')
  })

  it('lets the user dismiss a notice', async () => {
    seedCart({ ...pizzaLine, unitPriceCents: 900 })
    const { wrapper, cart } = await mountAppAt('/checkout')
    await vi.waitFor(() => {
      expect(cart.notices).toHaveLength(1)
    })
    await openCart(wrapper)

    button('Dismiss')?.click()

    await vi.waitFor(() => {
      expect(cart.notices).toHaveLength(0)
    })
    expect(cartButton(wrapper).attributes('aria-label')).toBe('Cart, 2 items')
  })

  it('checks again when the cart is opened, not only at startup', async () => {
    seedCart(pizzaLine)
    const { wrapper, cart } = await mountAppAt('/checkout')
    await vi.waitFor(() => {
      expect(cart.notices).toEqual([])
    })

    repriceDish('item-5', 1300) // the menu changes while the page is open
    await openCart(wrapper)

    await vi.waitFor(() => {
      expect(cart.lines[0]?.unitPriceCents).toBe(1300)
    })
    expect(dialog()?.textContent).toContain('now costs €13.00 (was €11.00)')
  })

  it('does not ask the menu anything for an empty cart', async () => {
    const requests: string[] = []
    server.use(
      mswHttp.get('/api/menu-items', ({ request }) => {
        requests.push(request.url)
        return undefined
      }),
    )
    const { wrapper } = await mountAppAt('/checkout')

    await openCart(wrapper)

    expect(requests).toEqual([])
  })

  it('says prices could not be checked, and keeps the cart as it is', async () => {
    server.use(
      mswHttp.get('/api/menu-items', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    seedCart(pizzaLine)
    const { wrapper, cart } = await mountAppAt('/checkout')

    await openCart(wrapper)

    await vi.waitFor(() => {
      expect(dialog()?.textContent).toContain('could not be checked')
    })
    expect(cart.itemCount).toBe(2)
  })
})
