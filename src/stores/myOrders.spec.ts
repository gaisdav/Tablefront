import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMyOrdersStore } from '@/stores/myOrders'
import { loadOrderIds, MAX_REMEMBERED_ORDERS, saveOrderIds } from '@/stores/myOrdersStorage'

const KEY = 'tablefront:orders'

function store(raw?: string) {
  if (raw !== undefined) localStorage.setItem(KEY, raw)
  setActivePinia(createPinia())
  return useMyOrdersStore()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the remembered orders', () => {
  it('starts empty', () => {
    const orders = store()

    expect(orders.ids).toEqual([])
    expect(orders.isEmpty).toBe(true)
  })

  it('remembers the newest first, once each', () => {
    const orders = store()

    orders.remember('ord-1')
    orders.remember('ord-2')
    orders.remember('ord-1')

    expect(orders.ids).toEqual(['ord-1', 'ord-2'])
    expect(orders.isEmpty).toBe(false)
  })

  it('forgets one order and leaves the others', () => {
    const orders = store()
    orders.remember('ord-1')
    orders.remember('ord-2')

    orders.forget('ord-1')
    orders.forget('ord-unknown')

    expect(orders.ids).toEqual(['ord-2'])
  })

  it('forgets the oldest once there are too many', () => {
    const orders = store()

    for (let number = 1; number <= MAX_REMEMBERED_ORDERS + 3; number += 1) {
      orders.remember(`ord-${String(number)}`)
    }

    expect(orders.ids).toHaveLength(MAX_REMEMBERED_ORDERS)
    expect(orders.ids[0]).toBe(`ord-${String(MAX_REMEMBERED_ORDERS + 3)}`)
    expect(orders.ids).not.toContain('ord-1')
  })
})

describe('persistence', () => {
  it('saves under a versioned key whenever the list changes', async () => {
    const orders = store()

    orders.remember('ord-1')
    orders.remember('ord-2')
    await nextTick()

    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
      version: 1,
      ids: ['ord-2', 'ord-1'],
    })
  })

  it('restores the list after a reload', async () => {
    const before = store()
    before.remember('ord-1')
    before.remember('ord-2')
    await nextTick()

    expect(store().ids).toEqual(['ord-2', 'ord-1'])
  })

  it.each([
    ['text that is not JSON', '{not json'],
    ['an empty string', ''],
    ['JSON null', 'null'],
    ['an array instead of an object', '["ord-1"]'],
    ['no version', JSON.stringify({ ids: ['ord-1'] })],
    ['another version', JSON.stringify({ version: 2, ids: ['ord-1'] })],
    ['a version stored as text', JSON.stringify({ version: '1', ids: ['ord-1'] })],
    ['ids that are not an array', JSON.stringify({ version: 1, ids: 'ord-1' })],
    ['missing ids', JSON.stringify({ version: 1 })],
  ])('treats %s as an empty list instead of crashing', (_label, raw) => {
    expect(store(raw).ids).toEqual([])
  })

  it('keeps the valid ids of a damaged list, without duplicates', () => {
    const raw = JSON.stringify({ version: 1, ids: ['ord-1', 5, '', null, 'ord-2', 'ord-1', {}] })

    expect(store(raw).ids).toEqual(['ord-1', 'ord-2'])
  })

  it('caps a list that is too long', () => {
    const ids = Array.from({ length: MAX_REMEMBERED_ORDERS + 10 }, (_, n) => `ord-${String(n)}`)

    localStorage.setItem(KEY, JSON.stringify({ version: 1, ids }))

    expect(loadOrderIds()).toHaveLength(MAX_REMEMBERED_ORDERS)
  })

  it('works when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(store().ids).toEqual([])
  })

  it('keeps working in memory when storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const orders = store()

    orders.remember('ord-1')
    await nextTick()

    expect(orders.ids).toEqual(['ord-1'])
    expect(() => {
      saveOrderIds(['ord-1'])
    }).not.toThrow()
  })
})
