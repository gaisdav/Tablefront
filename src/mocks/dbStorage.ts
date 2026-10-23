import { isStatusFor } from '@/domain/orderStatus'
import { isAllergen, isFulfillment, isOrderStatus, isRecord } from '@/domain/guards'
import { categories, menuItems as fixtureMenuItems } from '@/mocks/fixtures'
import type { MenuItem, Order, OrderLine } from '@/types/domain'

const STORAGE_KEY = 'tablefront:mock-db'

/** Bump when the shape of what is saved changes. (A change to the fixtures is noticed by itself.) */
const SCHEMA_VERSION = 1

/** A short fingerprint of the fixtures that the saved menu is built on (djb2 over their JSON). */
function fingerprint(text: string): string {
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Saved menu items are a full copy, not a change on top of the fixtures, so when the fixtures
 * change (a price fixed, a dish added) a returning visitor must not keep the old copy: the saved
 * database records which fixtures it grew from and is dropped when they are not these.
 */
const FIXTURES = fingerprint(JSON.stringify([categories, fixtureMenuItems]))

/** What the demo changes. Categories are not here: nothing can edit them. */
export interface SavedDb {
  menuItems: MenuItem[]
  orders: Order[]
  nextMenuItemNumber: number
  nextOrderNumber: number
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1

const isText = (value: unknown): value is string => typeof value === 'string' && value !== ''

function toMenuItem(value: unknown): MenuItem | null {
  if (!isRecord(value)) return null
  const { id, name, description, priceCents, categoryId, imageUrl, available, allergens } = value
  if (!isText(id) || !isText(name) || typeof description !== 'string') return null
  if (!isCount(priceCents) || !isText(categoryId)) return null
  if (imageUrl !== null && typeof imageUrl !== 'string') return null
  if (typeof available !== 'boolean') return null
  if (!Array.isArray(allergens) || !allergens.every(isAllergen)) return null
  return { id, name, description, priceCents, categoryId, imageUrl, available, allergens }
}

function toOrderLine(value: unknown): OrderLine | null {
  if (!isRecord(value)) return null
  const { menuItemId, name, unitPriceCents, quantity, note } = value
  if (!isText(menuItemId) || !isText(name) || !isCount(unitPriceCents) || !isCount(quantity)) {
    return null
  }
  if (note === undefined) return { menuItemId, name, unitPriceCents, quantity }
  return typeof note === 'string' ? { menuItemId, name, unitPriceCents, quantity, note } : null
}

function toOrder(value: unknown): Order | null {
  if (!isRecord(value)) return null
  const { id, lines, totalCents, status, fulfillment, customer, createdAt } = value
  if (!isText(id) || !Array.isArray(lines) || lines.length === 0) return null
  if (!isCount(totalCents) || !isOrderStatus(status) || !isFulfillment(fulfillment)) return null
  if (typeof createdAt !== 'string' || Number.isNaN(new Date(createdAt).getTime())) return null
  if (!isRecord(customer) || !isText(customer.name) || !isText(customer.phone)) return null
  const { address } = customer
  if (address !== undefined && typeof address !== 'string') return null

  const validLines = allValid(lines, toOrderLine)
  if (validLines === null) return null
  // What the API would never produce: a total that is not the lines' sum, a delivery without an
  // address, or a pickup that has one.
  if (
    totalCents !== validLines.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
  ) {
    return null
  }
  if (fulfillment === 'delivery' ? !isText(address) : address !== undefined) return null
  // "On the way" exists only for deliveries.
  if (!isStatusFor(fulfillment, status)) return null
  return {
    id,
    lines: validLines,
    totalCents,
    status,
    fulfillment,
    customer: {
      name: customer.name,
      phone: customer.phone,
      ...(address === undefined ? {} : { address }),
    },
    createdAt,
  }
}

/** Every value converted, or null as soon as one cannot be. */
function allValid<T>(
  values: readonly unknown[],
  convert: (value: unknown) => T | null,
): T[] | null {
  const result: T[] = []
  for (const value of values) {
    const item = convert(value)
    if (item === null) return null
    result.push(item)
  }
  return result
}

const hasUniqueIds = (items: readonly { id: string }[]): boolean =>
  new Set(items.map((item) => item.id)).size === items.length

/** The next number must be past every id already handed out, or the next record would reuse one. */
function counterIsPast(items: readonly { id: string }[], prefix: string, next: number): boolean {
  return items.every((item) => {
    const number = item.id.startsWith(prefix) ? Number(item.id.slice(prefix.length)) : 0
    return !(number >= next)
  })
}

/**
 * Reads the saved demo database. It never throws, and it is all or nothing: unlike a cart, a
 * database with a few damaged records would be wrong in ways nobody could see, so anything
 * unreadable, from another version or edited by hand means "start from the fixtures".
 */
export function loadSavedDb(): SavedDb | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const saved: unknown = JSON.parse(raw)
    if (!isRecord(saved) || saved.version !== SCHEMA_VERSION || saved.fixtures !== FIXTURES) {
      return null
    }
    const { menuItems, orders, nextMenuItemNumber, nextOrderNumber } = saved
    if (!Array.isArray(menuItems) || !Array.isArray(orders)) return null
    if (!isCount(nextMenuItemNumber) || !isCount(nextOrderNumber)) return null

    const validItems = allValid(menuItems, toMenuItem)
    const validOrders = allValid(orders, toOrder)
    if (validItems === null || validOrders === null) return null
    if (!hasUniqueIds(validItems) || !hasUniqueIds(validOrders)) return null
    const categoryIds = new Set(categories.map((category) => category.id))
    if (!validItems.every((item) => categoryIds.has(item.categoryId))) return null
    if (!counterIsPast(validItems, 'item-', nextMenuItemNumber)) return null
    if (!counterIsPast(validOrders, 'ord-', nextOrderNumber)) return null
    return {
      menuItems: validItems,
      orders: validOrders,
      nextMenuItemNumber,
      nextOrderNumber,
    }
  } catch {
    return null
  }
}

/**
 * Saves the database and says whether it worked. Storage that is full or blocked is not an error:
 * the demo keeps working in memory, and the caller knows not to trust storage over memory.
 */
export function saveDb(db: SavedDb): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        fixtures: FIXTURES,
        menuItems: db.menuItems,
        orders: db.orders,
        nextMenuItemNumber: db.nextMenuItemNumber,
        nextOrderNumber: db.nextOrderNumber,
      }),
    )
    return true
  } catch {
    return false
  }
}
