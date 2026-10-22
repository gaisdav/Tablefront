import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from '@/stores/cart'
import type { MenuItem } from '@/types/domain'

function dish(
  id: string,
  name: string,
  priceCents: number,
  overrides: Partial<MenuItem> = {},
): MenuItem {
  return {
    id,
    name,
    description: '',
    priceCents,
    categoryId: 'cat-mains',
    imageUrl: null,
    available: true,
    allergens: [],
    ...overrides,
  }
}

const margherita = dish('item-5', 'Margherita pizza', 1100)
const lemonade = dish('item-17', 'Lemonade', 450)

function freshStore() {
  setActivePinia(createPinia())
  return useCartStore()
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('cart: adding', () => {
  it('adds a dish as a new line with a snapshot of its name and price', () => {
    const cart = freshStore()

    cart.add(margherita)

    expect(cart.lines).toEqual([
      {
        menuItemId: 'item-5',
        name: 'Margherita pizza',
        unitPriceCents: 1100,
        quantity: 1,
        note: '',
      },
    ])
  })

  it('adds the requested quantity', () => {
    const cart = freshStore()

    cart.add(margherita, 3)

    expect(cart.quantityOf('item-5')).toBe(3)
  })

  it('increases the quantity instead of adding a second line when the dish is already in the cart', () => {
    const cart = freshStore()

    cart.add(margherita)
    cart.add(margherita, 2)

    expect(cart.lines).toHaveLength(1)
    expect(cart.quantityOf('item-5')).toBe(3)
  })

  it('never goes above the maximum quantity the server accepts', () => {
    const cart = freshStore()

    cart.add(margherita, 98)
    cart.add(margherita, 5)

    expect(cart.quantityOf('item-5')).toBe(99)
  })

  it('ignores a dish that is not available', () => {
    const cart = freshStore()

    cart.add(dish('item-8', 'Lasagna', 1500, { available: false }))

    expect(cart.isEmpty).toBe(true)
  })

  it.each([0, -2])('ignores a quantity of %i for a new dish', (quantity) => {
    const cart = freshStore()

    cart.add(margherita, quantity)

    expect(cart.isEmpty).toBe(true)
  })

  it('takes the latest name and price when a dish is added again', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.add({ ...margherita, name: 'Pizza Margherita', priceCents: 1200 })

    expect(cart.lines[0]).toMatchObject({
      name: 'Pizza Margherita',
      unitPriceCents: 1200,
      quantity: 2,
    })
  })

  it('tells the user when adding again reprices the dish', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.add({ ...margherita, priceCents: 1200 })
    cart.add({ ...margherita, priceCents: 1200 })

    expect(cart.notices).toMatchObject([
      { kind: 'price-changed', name: 'Margherita pizza', fromCents: 1100, toCents: 1200 },
    ])
  })

  it('ignores NaN quantities instead of poisoning the totals', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.setQuantity('item-5', Number.NaN)
    cart.add(margherita, Number.NaN)

    expect(cart.subtotalCents).toBe(1100)
  })
})

describe('cart: changing quantity, notes and lines', () => {
  it('sets the quantity of a line', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.setQuantity('item-5', 4)

    expect(cart.quantityOf('item-5')).toBe(4)
  })

  it.each([0, -1])('removes the line when the quantity is set to %i', (quantity) => {
    const cart = freshStore()
    cart.add(margherita)

    cart.setQuantity('item-5', quantity)

    expect(cart.isEmpty).toBe(true)
  })

  it('caps the quantity and drops fractions', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.setQuantity('item-5', 250)
    expect(cart.quantityOf('item-5')).toBe(99)

    cart.setQuantity('item-5', 2.9)
    expect(cart.quantityOf('item-5')).toBe(2)
  })

  it('does nothing for a dish that is not in the cart', () => {
    const cart = freshStore()

    cart.setQuantity('item-5', 3)
    cart.setNote('item-5', 'x')

    expect(cart.isEmpty).toBe(true)
  })

  it('keeps a note per line, limited to the length the server accepts', () => {
    const cart = freshStore()
    cart.add(margherita)
    cart.add(lemonade)

    cart.setNote('item-5', 'Extra basil')
    cart.setNote('item-17', 'x'.repeat(300))

    expect(cart.lines.find((line) => line.menuItemId === 'item-5')?.note).toBe('Extra basil')
    expect(cart.lines.find((line) => line.menuItemId === 'item-17')?.note).toHaveLength(200)
  })

  it('keeps the note when the quantity changes', () => {
    const cart = freshStore()
    cart.add(margherita)
    cart.setNote('item-5', 'Extra basil')

    cart.setQuantity('item-5', 3)
    cart.add(margherita)

    expect(cart.lines[0]?.note).toBe('Extra basil')
  })

  it('removes one line and leaves the others', () => {
    const cart = freshStore()
    cart.add(margherita)
    cart.add(lemonade)

    cart.remove('item-5')

    expect(cart.lines.map((line) => line.menuItemId)).toEqual(['item-17'])
  })

  it('clears everything', () => {
    const cart = freshStore()
    cart.add(margherita)
    cart.add(lemonade)

    cart.clear()

    expect(cart.isEmpty).toBe(true)
    expect(cart.itemCount).toBe(0)
  })
})

describe('cart: totals', () => {
  it('is empty at first', () => {
    const cart = freshStore()

    expect(cart.isEmpty).toBe(true)
    expect(cart.itemCount).toBe(0)
    expect(cart.subtotalCents).toBe(0)
  })

  it('counts items, not lines, and sums in whole cents', () => {
    const cart = freshStore()

    cart.add(margherita, 3) // 3 × 1100
    cart.add(lemonade, 2) // 2 × 450

    expect(cart.itemCount).toBe(5)
    expect(cart.subtotalCents).toBe(3 * 1100 + 2 * 450)
    expect(Number.isInteger(cart.subtotalCents)).toBe(true)
  })

  it('follows every change', () => {
    const cart = freshStore()
    cart.add(margherita, 2)

    cart.setQuantity('item-5', 1)
    expect(cart.subtotalCents).toBe(1100)

    cart.add(lemonade)
    expect(cart.subtotalCents).toBe(1550)

    cart.remove('item-5')
    expect(cart.subtotalCents).toBe(450)
    expect(cart.itemCount).toBe(1)
  })

  it('reports how many of a dish are in the cart', () => {
    const cart = freshStore()
    cart.add(margherita, 2)

    expect(cart.quantityOf('item-5')).toBe(2)
    expect(cart.quantityOf('item-17')).toBe(0)
  })
})

describe('cart: reconciling with the current menu', () => {
  it('removes a dish that is no longer on the menu, and says so', () => {
    const cart = freshStore()
    cart.add(margherita)
    cart.add(lemonade)

    cart.reconcile([margherita]) // lemonade is gone

    expect(cart.lines.map((line) => line.menuItemId)).toEqual(['item-5'])
    expect(cart.notices).toMatchObject([{ kind: 'removed', name: 'Lemonade' }])
  })

  it('removes a dish that is still listed but no longer available', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.reconcile([{ ...margherita, available: false }])

    expect(cart.isEmpty).toBe(true)
    expect(cart.notices).toHaveLength(1)
  })

  it('updates a changed price, keeps quantity and note, and says so', () => {
    const cart = freshStore()
    cart.add(margherita, 2)
    cart.setNote('item-5', 'Extra basil')

    cart.reconcile([{ ...margherita, priceCents: 1250 }])

    expect(cart.lines[0]).toMatchObject({ unitPriceCents: 1250, quantity: 2, note: 'Extra basil' })
    expect(cart.subtotalCents).toBe(2500)
    expect(cart.notices).toMatchObject([
      {
        kind: 'price-changed',
        name: 'Margherita pizza',
        fromCents: 1100,
        toCents: 1250,
      },
    ])
  })

  it('says nothing and changes nothing when the cart already matches the menu', () => {
    const cart = freshStore()
    cart.add(margherita)
    const before = cart.lines

    cart.reconcile([margherita, lemonade])

    expect(cart.lines).toBe(before)
    expect(cart.notices).toEqual([])
  })

  it('adopts a renamed dish without bothering the user', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.reconcile([{ ...margherita, name: 'Pizza Margherita' }])

    expect(cart.lines[0]?.name).toBe('Pizza Margherita')
    expect(cart.notices).toEqual([])
  })

  it('keeps the cart when the menu comes back empty', () => {
    const cart = freshStore()
    cart.add(margherita)

    cart.reconcile([])

    expect(cart.lines).toHaveLength(1)
    expect(cart.notices).toEqual([])
  })

  it('does not repeat a notice when reconciled again', () => {
    const cart = freshStore()
    cart.add(margherita)
    const menu = [{ ...margherita, priceCents: 1250 }]

    cart.reconcile(menu)
    cart.reconcile(menu)

    expect(cart.notices).toHaveLength(1)
  })

  it('lets the user dismiss a notice', () => {
    const cart = freshStore()
    cart.add(margherita)
    cart.add(lemonade)
    cart.reconcile([dish('item-99', 'Other', 100)])
    const [first, second] = cart.notices
    expect(first?.id).not.toBe(second?.id)

    cart.dismissNotice(first?.id ?? -1)

    expect(cart.notices.map((notice) => notice.id)).toEqual([second?.id])
  })
})

function readSaved(): unknown {
  const raw = localStorage.getItem('tablefront:cart')
  const saved: unknown = raw === null ? null : JSON.parse(raw)
  return saved
}

describe('cart: persistence', () => {
  it('saves the cart under a versioned key whenever it changes', async () => {
    const cart = freshStore()

    cart.add(margherita, 2)
    await nextTick()

    expect(readSaved()).toEqual({
      version: 1,
      lines: [
        {
          menuItemId: 'item-5',
          name: 'Margherita pizza',
          unitPriceCents: 1100,
          quantity: 2,
          note: '',
        },
      ],
    })
  })

  it('saves note edits and removals too', async () => {
    const cart = freshStore()
    cart.add(margherita)
    cart.add(lemonade)
    await nextTick()

    cart.setNote('item-5', 'Extra basil')
    cart.remove('item-17')
    await nextTick()

    expect(readSaved()).toMatchObject({
      lines: [
        {
          menuItemId: 'item-5',
          name: 'Margherita pizza',
          unitPriceCents: 1100,
          quantity: 1,
          note: 'Extra basil',
        },
      ],
    })
  })

  it('restores the cart after a reload', async () => {
    const before = freshStore()
    before.add(margherita, 2)
    before.setNote('item-5', 'Extra basil')
    await nextTick()

    const after = freshStore() // a new app instance reads the saved cart

    expect(after.lines).toEqual(before.lines)
    expect(after.itemCount).toBe(2)
  })
})
