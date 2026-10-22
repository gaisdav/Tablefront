import {
  NEXT_MENU_ITEM_NUMBER,
  NEXT_ORDER_NUMBER,
  categories,
  createSeedOrders,
  menuItems,
} from '@/mocks/fixtures'
import { loadSavedDb, saveDb } from '@/mocks/dbStorage'
import type { MenuItemInput } from '@/types/api'
import type { Category, MenuItem, Order, OrderStatus } from '@/types/domain'

// In-memory store. Everything lives in module state, so by default a page reload (or `resetDb` in
// tests) starts again from the fixtures. The browser build turns on persistence, which keeps what
// the demo changes (orders and the menu) in localStorage across reloads; tests never do.
interface State {
  categories: Category[]
  menuItems: MenuItem[]
  orders: Order[]
  nextMenuItemNumber: number
  nextOrderNumber: number
}

function createState(): State {
  return {
    categories: structuredClone(categories),
    menuItems: structuredClone(menuItems),
    orders: createSeedOrders(new Date()),
    nextMenuItemNumber: NEXT_MENU_ITEM_NUMBER,
    nextOrderNumber: NEXT_ORDER_NUMBER,
  }
}

let state = createState()

let persistent = false
/** The last save failed, so memory is newer than storage and must not be replaced by it. */
let unsaved = false

function persist(): void {
  if (persistent) unsaved = !saveDb(state)
}

/**
 * Picks up what another tab saved. Every call into the database starts here, so two tabs share one
 * database: neither works from a stale copy, and neither hands out an id the other already used.
 */
function sync(): void {
  if (!persistent || unsaved) return
  const saved = loadSavedDb()
  if (saved !== null) state = { ...state, ...saved }
}

/**
 * Keeps the database across page reloads: starts from what was saved (if it is readable) and saves
 * after every change from now on. Used by the browser build only. Calling it again is harmless.
 */
export function enableDbPersistence(): void {
  persistent = true
  sync()
}

export function disableDbPersistence(): void {
  persistent = false
  unsaved = false
}

/** Back to the fixtures; with persistence on, the saved copy is replaced too ("reset demo data"). */
export function resetDb(): void {
  state = createState()
  persist()
}

export interface MenuItemFilter {
  categoryId?: string
  q?: string
  includeUnavailable: boolean
}

/** Orders kept; the oldest go first, so a demo used for a long time stays small and saveable. */
export const MAX_ORDERS = 200

export const db = {
  listCategories(): Category[] {
    sync()
    return [...state.categories].sort((a, b) => a.sortOrder - b.sortOrder)
  },

  hasCategory(id: string): boolean {
    sync()
    return state.categories.some((category) => category.id === id)
  },

  /** Grouped by category in the categories' order; within a category, in the order they were added. */
  listMenuItems(filter: MenuItemFilter): MenuItem[] {
    sync()
    const query = filter.q?.trim().toLowerCase() ?? ''
    const categoryRank = new Map(
      state.categories.map((category) => [category.id, category.sortOrder]),
    )
    return state.menuItems
      .filter(
        (item) =>
          (filter.includeUnavailable || item.available) &&
          (filter.categoryId === undefined || item.categoryId === filter.categoryId) &&
          (query === '' ||
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)),
      )
      .sort((a, b) => (categoryRank.get(a.categoryId) ?? 0) - (categoryRank.get(b.categoryId) ?? 0))
  },

  getMenuItem(id: string): MenuItem | undefined {
    sync()
    return state.menuItems.find((item) => item.id === id)
  },

  createMenuItem(input: MenuItemInput): MenuItem {
    sync()
    const item: MenuItem = { id: `item-${String(state.nextMenuItemNumber)}`, ...input }
    state.nextMenuItemNumber += 1
    state.menuItems.push(item)
    persist()
    return item
  },

  replaceMenuItem(id: string, input: MenuItemInput): MenuItem | undefined {
    sync()
    const index = state.menuItems.findIndex((item) => item.id === id)
    if (index === -1) return undefined
    const item: MenuItem = { id, ...input }
    state.menuItems[index] = item
    persist()
    return item
  },

  deleteMenuItem(id: string): boolean {
    sync()
    const index = state.menuItems.findIndex((item) => item.id === id)
    if (index === -1) return false
    state.menuItems.splice(index, 1)
    persist()
    return true
  },

  getOrder(id: string): Order | undefined {
    sync()
    return state.orders.find((order) => order.id === id)
  },

  /** Newest first. Orders created in the same millisecond keep the later one first. */
  listOrders(status?: OrderStatus): Order[] {
    sync()
    return state.orders
      .filter((order) => status === undefined || order.status === status)
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  createOrder(input: Pick<Order, 'lines' | 'fulfillment' | 'customer'>): Order {
    sync()
    const order: Order = {
      id: `ord-${String(state.nextOrderNumber)}`,
      ...input,
      totalCents: input.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
      status: 'new',
      createdAt: new Date().toISOString(),
    }
    state.nextOrderNumber += 1
    state.orders.push(order)
    if (state.orders.length > MAX_ORDERS) state.orders.splice(0, state.orders.length - MAX_ORDERS)
    persist()
    return order
  },

  setOrderStatus(id: string, status: OrderStatus): Order | undefined {
    sync()
    const order = state.orders.find((candidate) => candidate.id === id)
    if (order === undefined) return undefined
    order.status = status
    persist()
    return order
  },
}
