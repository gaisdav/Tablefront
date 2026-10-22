import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from '@/stores/cart'
import { loadCartLines, saveCartLines } from '@/stores/cartStorage'

const KEY = 'tablefront:cart'

const validLine = {
  menuItemId: 'item-5',
  name: 'Margherita pizza',
  unitPriceCents: 1100,
  quantity: 2,
  note: '',
}

function store(raw: string | null) {
  if (raw !== null) localStorage.setItem(KEY, raw)
  setActivePinia(createPinia())
  return useCartStore()
}

function save(value: unknown): string {
  return JSON.stringify(value)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loading a saved cart', () => {
  it('starts empty when nothing was saved', () => {
    expect(store(null).isEmpty).toBe(true)
  })

  it('restores a valid cart', () => {
    expect(store(save({ version: 1, lines: [validLine] })).lines).toEqual([validLine])
  })

  it.each([
    ['text that is not JSON', '{not json'],
    ['an empty string', ''],
    ['JSON null', 'null'],
    ['a bare number', '42'],
    ['an array instead of an object', '[1,2]'],
    ['an object without a version', save({ lines: [validLine] })],
    ['a newer schema version', save({ version: 2, lines: [validLine] })],
    ['an older schema version', save({ version: 0, lines: [validLine] })],
    ['a version stored as text', save({ version: '1', lines: [validLine] })],
    ['lines that are not an array', save({ version: 1, lines: 'nope' })],
    ['missing lines', save({ version: 1 })],
  ])('treats %s as no cart instead of crashing', (_label, raw) => {
    expect(store(raw).isEmpty).toBe(true)
  })

  it.each([
    ['a missing id', { ...validLine, menuItemId: '' }],
    ['a non-string id', { ...validLine, menuItemId: 5 }],
    ['an empty name', { ...validLine, name: '' }],
    ['a fractional price', { ...validLine, unitPriceCents: 10.5 }],
    ['a zero price', { ...validLine, unitPriceCents: 0 }],
    ['a negative price', { ...validLine, unitPriceCents: -100 }],
    ['a price as text', { ...validLine, unitPriceCents: '1100' }],
    ['a zero quantity', { ...validLine, quantity: 0 }],
    ['a fractional quantity', { ...validLine, quantity: 1.5 }],
    ['a quantity above the maximum', { ...validLine, quantity: 100 }],
    ['a note that is not text', { ...validLine, note: 7 }],
    ['a note that is too long', { ...validLine, note: 'x'.repeat(201) }],
    ['a line that is not an object', 'item-5'],
    ['a null line', null],
  ])('drops a line with %s but keeps the valid ones', (_label, bad) => {
    const other = {
      ...validLine,
      menuItemId: 'item-17',
      name: 'Lemonade',
      unitPriceCents: 450,
      quantity: 1,
    }

    const cart = store(save({ version: 1, lines: [bad, other] }))

    expect(cart.lines).toEqual([other])
  })

  it('keeps one line per dish when a save contains duplicates', () => {
    const cart = store(save({ version: 1, lines: [validLine, { ...validLine, quantity: 9 }] }))

    expect(cart.lines).toEqual([validLine])
  })

  it('ignores extra fields, so a hand-edited save cannot smuggle data into the cart', () => {
    const cart = store(save({ version: 1, lines: [{ ...validLine, role: 'admin' }] }))

    expect(cart.lines).toEqual([validLine])
  })

  it('starts empty when reading storage throws (blocked or disabled)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })

    expect(store(null).isEmpty).toBe(true)
  })
})

describe('saving the cart', () => {
  it('keeps working in memory when storage is full', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const cart = store(null)

    cart.add({
      id: 'item-5',
      name: 'Margherita pizza',
      description: '',
      priceCents: 1100,
      categoryId: 'c',
      imageUrl: null,
      available: true,
      allergens: [],
    })
    await nextTick()

    expect(cart.itemCount).toBe(1)
    expect(cart.subtotalCents).toBe(1100)
  })

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })

    expect(() => {
      saveCartLines([validLine])
    }).not.toThrow()
  })

  it('overwrites a corrupt save with a good one on the next change', async () => {
    const cart = store('{broken')

    cart.add({
      id: 'item-5',
      name: 'Margherita pizza',
      description: '',
      priceCents: 1100,
      categoryId: 'c',
      imageUrl: null,
      available: true,
      allergens: [],
    })
    await nextTick()

    expect(JSON.parse(localStorage.getItem(KEY) ?? '')).toMatchObject({ version: 1 })
    expect(loadCartLines()).toHaveLength(1)
  })
})
