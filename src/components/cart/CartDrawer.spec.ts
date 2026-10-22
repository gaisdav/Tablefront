import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CartDrawer from '@/components/cart/CartDrawer.vue'
import type { CartLine, CartNotice } from '@/types/cart'

const pizza: CartLine = {
  menuItemId: 'item-5',
  name: 'Margherita pizza',
  unitPriceCents: 1100,
  quantity: 2,
  note: '',
}
const lemonade: CartLine = {
  menuItemId: 'item-17',
  name: 'Lemonade',
  unitPriceCents: 450,
  quantity: 1,
  note: 'No ice',
}

const mounted: VueWrapper[] = []
let opener: HTMLButtonElement | null = null

function mountDrawer(
  props: {
    lines?: CartLine[]
    notices?: CartNotice[]
    priceCheckFailed?: boolean
    open?: boolean
  } = {},
) {
  opener = document.createElement('button')
  opener.textContent = 'Cart'
  document.body.append(opener)
  opener.focus()

  const lines = props.lines ?? [pizza, lemonade]
  const wrapper = mount(CartDrawer, {
    props: {
      open: true,
      lines,
      subtotalCents: lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
      notices: [],
      ...props,
    },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

const drawer = () => document.querySelector<HTMLElement>('[role="dialog"]')
const byLabel = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`)
const press = (key: string, options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
  ;(document.activeElement ?? document.body).dispatchEvent(event)
  return event
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  opener?.remove()
  opener = null
  document.body.classList.remove('scroll-locked')
})

describe('CartDrawer content', () => {
  it('lists each line with its total, and the order total', () => {
    mountDrawer()

    expect(drawer()?.textContent).toContain('Margherita pizza')
    expect(drawer()?.textContent).toContain('€22.00') // 2 × 11.00
    expect(drawer()?.textContent).toContain('Lemonade')
    expect(drawer()?.querySelector('.summary__total')?.textContent).toContain('€26.50')
  })

  it('is a labelled modal dialog', () => {
    mountDrawer()

    expect(drawer()?.getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(drawer()?.getAttribute('aria-labelledby') ?? '')
    expect(title?.textContent).toBe('Your order')
  })

  it('shows an empty cart with a way back to the menu, and no checkout', () => {
    const wrapper = mountDrawer({ lines: [] })

    expect(drawer()?.textContent).toContain('Your cart is empty')
    expect(drawer()?.textContent).not.toContain('Go to checkout')

    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Browse the menu')
      ?.click()
    expect(wrapper.emitted('browse')).toHaveLength(1)
  })

  it('tells the user what changed without them doing it', () => {
    mountDrawer({
      notices: [
        { id: 1, kind: 'removed', name: 'Lasagna' },
        { id: 2, kind: 'price-changed', name: 'Margherita pizza', fromCents: 1100, toCents: 1250 },
      ],
    })

    const list = drawer()?.querySelector('[aria-label="Changes to your cart"]')
    expect(list?.textContent).toContain(
      'Lasagna is no longer available and was removed from your cart.',
    )
    expect(list?.textContent).toContain('Margherita pizza now costs €12.50 (was €11.00).')
  })

  it('says when prices could not be checked', () => {
    mountDrawer({ priceCheckFailed: true })

    expect(drawer()?.textContent).toContain('could not be checked')
  })
})

describe('CartDrawer events', () => {
  it('asks to change a quantity, naming the dish', () => {
    const wrapper = mountDrawer()

    byLabel('Increase quantity')?.click()

    expect(wrapper.emitted('updateQuantity')).toEqual([['item-5', 3]])
  })

  it('asks to remove a line', () => {
    const wrapper = mountDrawer()

    byLabel('Remove Lemonade from cart')?.click()

    expect(wrapper.emitted('remove')).toEqual([['item-17']])
  })

  it('asks to save a note, keeping the dish it belongs to', () => {
    const wrapper = mountDrawer()
    const note = byLabel('Note for Margherita pizza')
    if (!(note instanceof HTMLInputElement)) throw new Error('note field not found')

    note.value = 'Extra basil'
    note.dispatchEvent(new Event('input', { bubbles: true }))

    expect(note.getAttribute('maxlength')).toBe('200')
    expect(wrapper.emitted('updateNote')).toEqual([['item-5', 'Extra basil']])
  })

  it('shows the saved note', () => {
    mountDrawer()

    const note = byLabel('Note for Lemonade')
    expect(note instanceof HTMLInputElement && note.value).toBe('No ice')
  })

  it('asks to dismiss a notice and to check out', () => {
    const wrapper = mountDrawer({ notices: [{ id: 7, kind: 'removed', name: 'Lasagna' }] })

    byLabel('Dismiss: Lasagna is no longer available and was removed from your cart.')?.click()
    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Go to checkout')
      ?.click()

    expect(wrapper.emitted('dismissNotice')).toEqual([[7]])
    expect(wrapper.emitted('checkout')).toHaveLength(1)
  })
})

describe('CartDrawer keyboard', () => {
  it('moves focus into the drawer when it opens', async () => {
    mountDrawer()

    await vi.waitFor(() => {
      expect(drawer()?.contains(document.activeElement)).toBe(true)
    })
  })

  it('starts on the first control of the order, not on the close button', async () => {
    mountDrawer()

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(byLabel('Decrease quantity'))
    })
  })

  it('closes on Escape and returns focus to the cart button', async () => {
    const wrapper = mountDrawer()
    await vi.waitFor(() => {
      expect(drawer()?.contains(document.activeElement)).toBe(true)
    })

    press('Escape')
    await wrapper.setProps({ open: false })

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(document.activeElement).toBe(opener)
  })

  it('keeps Tab inside the drawer, wrapping from the last control to the first', async () => {
    mountDrawer()
    await vi.waitFor(() => {
      expect(drawer()?.contains(document.activeElement)).toBe(true)
    })
    const controls = [...(drawer()?.querySelectorAll<HTMLElement>('button, input') ?? [])]
    const last = controls[controls.length - 1]
    last?.focus()

    const event = press('Tab')

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(byLabel('Close dialog'))
  })

  it('wraps Shift+Tab from the close button to the last control', async () => {
    mountDrawer()
    await vi.waitFor(() => {
      expect(drawer()?.contains(document.activeElement)).toBe(true)
    })
    byLabel('Close dialog')?.focus()

    press('Tab', { shiftKey: true })

    expect(document.activeElement?.textContent).toBe('Go to checkout')
  })

  it('has only real buttons and fields to operate, all reachable by keyboard', () => {
    mountDrawer()

    const controls = [...(drawer()?.querySelectorAll<HTMLElement>('button, input') ?? [])]
    expect(controls.length).toBeGreaterThan(0)
    expect(controls.every((control) => control.tabIndex >= 0)).toBe(true)
    expect(controls.every((control) => !control.hasAttribute('disabled'))).toBe(true)
  })
})
