import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRecord } from '@/domain/guards'
import { menuItems, NEXT_ORDER_NUMBER } from '@/mocks/fixtures'
import type { MenuItemInput } from '@/types/api'

// jsdom is not a browser, so the service worker cannot be set up; the entry point is imported only
// to see what it switches on.
vi.mock('msw/browser', () => ({ setupWorker: () => ({}) }))

const KEY = 'tablefront:mock-db'

/** A page load: the module is evaluated again, so its in-memory state starts from scratch. */
async function pageLoad() {
  vi.resetModules()
  return import('@/mocks/db')
}

async function persistentPageLoad() {
  const module = await pageLoad()
  module.enableDbPersistence()
  return module.db
}

const dish = menuItems.find((item) => item.available)
if (dish === undefined) throw new Error('no dish')

const orderInput = {
  lines: [{ menuItemId: dish.id, name: dish.name, unitPriceCents: dish.priceCents, quantity: 2 }],
  fulfillment: 'pickup' as const,
  customer: { name: 'Anna', phone: '+49 30 1234567' },
}

const itemInput: MenuItemInput = {
  name: 'Apfelstrudel',
  description: 'Warm, with vanilla sauce.',
  priceCents: 650,
  categoryId: 'cat-desserts',
  imageUrl: null,
  available: true,
  allergens: ['gluten'],
}

type Json = Record<string, unknown>

/** The saved database as plain JSON, for tests that damage it on purpose. */
interface Raw extends Json {
  menuItems: Json[]
  orders: Json[]
}

function readRaw(): Raw {
  const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  if (!isRecord(value) || !Array.isArray(value.menuItems) || !Array.isArray(value.orders)) {
    throw new Error('nothing saved')
  }
  return {
    ...value,
    menuItems: value.menuItems.filter(isRecord),
    orders: value.orders.filter(isRecord),
  }
}

function first(list: Json[]): Json {
  const [item] = list
  if (item === undefined) throw new Error('empty')
  return item
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a persistent mock database', () => {
  it('writes nothing unless persistence is switched on', async () => {
    const { db } = await pageLoad()

    db.createOrder(orderInput)

    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('starts from the fixtures when nothing was saved', async () => {
    const db = await persistentPageLoad()

    expect(db.listMenuItems({ includeUnavailable: true })).toHaveLength(menuItems.length)
    expect(db.getOrder(`ord-${String(NEXT_ORDER_NUMBER)}`)).toBeUndefined()
  })

  it('keeps an order across a reload, and keeps numbering from where it was', async () => {
    const before = await persistentPageLoad()
    const order = before.createOrder(orderInput)

    const after = await persistentPageLoad()

    expect(after.getOrder(order.id)).toEqual(order)
    expect(after.createOrder(orderInput).id).not.toBe(order.id)
  })

  it('loads a database saved before the seeded delivery on its way existed, and numbers on from it', async () => {
    // Saved by an older build: no seeded "ord-1008", a guest's order took that number.
    const first = await persistentPageLoad()
    const guest = first.createOrder(orderInput)
    const raw = readRaw()
    raw.orders = raw.orders.filter((saved) => saved.id !== guest.id && saved.id !== 'ord-1008')
    raw.orders.push({ ...guest, id: 'ord-1008' })
    raw.nextOrderNumber = 1009
    localStorage.setItem(KEY, JSON.stringify(raw))

    const after = await persistentPageLoad()

    expect(after.getOrder('ord-1008')).toMatchObject({ customer: guest.customer })
    expect(after.getOrder('ord-1008')?.status).toBe('new') // the guest's, not the seeded delivery
    expect(after.listOrders().map((o) => o.id)).toEqual([
      ...new Set(after.listOrders().map((o) => o.id)),
    ])
    expect(after.createOrder(orderInput).id).toBe('ord-1009')
  })

  it('keeps a status change', async () => {
    const before = await persistentPageLoad()
    const order = before.createOrder(orderInput)
    before.setOrderStatus(order.id, 'preparing')

    expect((await persistentPageLoad()).getOrder(order.id)?.status).toBe('preparing')
  })

  it('keeps menu edits: create, replace and delete', async () => {
    const before = await persistentPageLoad()
    const created = before.createMenuItem(itemInput)
    before.replaceMenuItem(dish.id, { ...itemInput, name: 'Renamed' })
    before.deleteMenuItem(menuItems[1]?.id ?? '')

    const after = await persistentPageLoad()

    expect(after.getMenuItem(created.id)?.name).toBe('Apfelstrudel')
    expect(after.getMenuItem(dish.id)?.name).toBe('Renamed')
    expect(after.getMenuItem(menuItems[1]?.id ?? '')).toBeUndefined()
    expect(after.createMenuItem(itemInput).id).not.toBe(created.id)
  })

  it('goes back to the fixtures on reset, and saves that too', async () => {
    const module = await pageLoad()
    module.enableDbPersistence()
    const order = module.db.createOrder(orderInput)

    module.resetDb()

    expect(module.db.getOrder(order.id)).toBeUndefined()
    expect((await persistentPageLoad()).getOrder(order.id)).toBeUndefined()
  })

  it('stops saving when persistence is switched off again', async () => {
    const module = await pageLoad()
    module.enableDbPersistence()
    module.disableDbPersistence()

    module.db.createOrder(orderInput)

    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe('two tabs', () => {
  it("share one database: neither loses the other's order or reuses its id", async () => {
    const tabA = await persistentPageLoad()
    const tabB = await persistentPageLoad() // loaded before A has done anything

    const fromA = tabA.createOrder(orderInput)
    const fromB = tabB.createOrder(orderInput)

    expect(fromB.id).not.toBe(fromA.id)
    expect(tabB.getOrder(fromA.id)).toEqual(fromA)
    expect(tabA.getOrder(fromB.id)).toEqual(fromB)
    expect((await persistentPageLoad()).listOrders().map((order) => order.id)).toEqual(
      expect.arrayContaining([fromA.id, fromB.id]),
    )
  })

  it('see a status change made in the other', async () => {
    const tabA = await persistentPageLoad()
    const tabB = await persistentPageLoad()
    const order = tabA.createOrder(orderInput)

    tabB.setOrderStatus(order.id, 'ready')

    expect(tabA.getOrder(order.id)?.status).toBe('ready')
  })
})

describe('persistence edge cases', () => {
  it('can be switched on twice without throwing away what was done in between', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const module = await pageLoad()
    module.enableDbPersistence()
    const order = module.db.createOrder(orderInput)

    module.enableDbPersistence()

    expect(module.db.getOrder(order.id)).toEqual(order)
  })

  it('does not replace newer memory with older storage after a failed save', async () => {
    const module = await pageLoad()
    module.enableDbPersistence()
    const saved = module.db.createOrder(orderInput)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const unsaved = module.db.createOrder(orderInput)

    expect(module.db.getOrder(unsaved.id)).toEqual(unsaved)
    expect(module.db.getOrder(saved.id)).toEqual(saved)
  })

  it('keeps only the newest orders, so it stays small enough to save', async () => {
    const module = await pageLoad()
    module.enableDbPersistence()
    const first = module.db.createOrder(orderInput)

    for (let count = 0; count < module.MAX_ORDERS + 5; count += 1) module.db.createOrder(orderInput)

    expect(module.db.listOrders()).toHaveLength(module.MAX_ORDERS)
    expect(module.db.getOrder(first.id)).toBeUndefined()
    expect((await persistentPageLoad()).listOrders()).toHaveLength(module.MAX_ORDERS)
  })
})

describe('a saved database that cannot be trusted', () => {
  async function savedWith(change: (raw: Raw) => void) {
    const before = await persistentPageLoad()
    const order = before.createOrder(orderInput)
    const raw = readRaw()
    change(raw)
    localStorage.setItem(KEY, JSON.stringify(raw))
    const after = await persistentPageLoad()
    return { after, order }
  }

  it.each([
    ['text that is not JSON', '{not json'],
    ['an empty string', ''],
    ['JSON null', 'null'],
    ['an array', '[]'],
    ['no version', JSON.stringify({ menuItems: [], orders: [] })],
  ])('starts from the fixtures for %s', async (_label, raw) => {
    localStorage.setItem(KEY, raw)

    const db = await persistentPageLoad()

    expect(db.listMenuItems({ includeUnavailable: true })).toHaveLength(menuItems.length)
  })

  const damage: [string, (raw: Raw) => void][] = [
    ['another version', (raw) => (raw.version = 2)],
    ['a version stored as text', (raw) => (raw.version = '1')],
    ['a bad counter', (raw) => (raw.nextOrderNumber = 0)],
    ['a fractional total', (raw) => (first(raw.orders).totalCents = 1.5)],
    ['an unknown status', (raw) => (first(raw.orders).status = 'lost')],
    ['an order without lines', (raw) => (first(raw.orders).lines = [])],
    ['an unreadable date', (raw) => (first(raw.orders).createdAt = 'soon')],
    ['a customer without a phone', (raw) => (first(raw.orders).customer = { name: 'A' })],
    [
      'a line with a bad quantity',
      (raw) =>
        (first(raw.orders).lines = [
          { menuItemId: 'x', name: 'x', unitPriceCents: 100, quantity: 0 },
        ]),
    ],
    ['fixtures it was not built on', (raw) => (raw.fixtures = 'older fixtures')],
    ['a counter that would reuse an id', (raw) => (raw.nextOrderNumber = 1)],
    ['a menu item counter that would reuse an id', (raw) => (raw.nextMenuItemNumber = 1)],
    [
      'a menu item in a category that does not exist',
      (raw) => (first(raw.menuItems).categoryId = 'cat-x'),
    ],
    ['a total that is not the sum of the lines', (raw) => (first(raw.orders).totalCents = 1)],
    ['a delivery without an address', (raw) => (first(raw.orders).fulfillment = 'delivery')],
    [
      'a pickup with an address',
      (raw) =>
        (first(raw.orders).customer = { name: 'Anna', phone: '+49 30 1234567', address: 'x' }),
    ],
    ['a pickup that is on the way', (raw) => (first(raw.orders).status = 'out_for_delivery')],
    ['a duplicate order id', (raw) => raw.orders.push({ ...first(raw.orders) })],
    [
      'a menu item with an unknown allergen',
      (raw) => (first(raw.menuItems).allergens = ['pollen']),
    ],
  ]

  it.each(damage)(
    'drops the whole database, not just the record, for %s',
    async (_label, change) => {
      const { after, order } = await savedWith(change)

      expect(after.getOrder(order.id)).toBeUndefined()
      expect(after.listMenuItems({ includeUnavailable: true })).toHaveLength(menuItems.length)
    },
  )

  it('also drops orders that are not an array', async () => {
    const before = await persistentPageLoad()
    const order = before.createOrder(orderInput)
    localStorage.setItem(KEY, JSON.stringify({ ...readRaw(), orders: {} }))

    const after = await persistentPageLoad()

    expect(after.getOrder(order.id)).toBeUndefined()
  })

  it('starts from the fixtures when storage cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    const db = await persistentPageLoad()

    expect(db.listMenuItems({ includeUnavailable: true })).toHaveLength(menuItems.length)
  })

  it('keeps working in memory when storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const db = await persistentPageLoad()

    const order = db.createOrder(orderInput)

    expect(db.getOrder(order.id)).toEqual(order)
  })
})

describe('the browser entry point', () => {
  it('turns persistence on, so orders survive a refresh of the demo', async () => {
    vi.resetModules()
    const { db } = await import('@/mocks/db')
    await import('@/mocks/browser')

    const order = db.createOrder(orderInput)

    expect(localStorage.getItem(KEY)).toContain(order.id)
  })
})
