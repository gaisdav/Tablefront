import {
  NEXT_MENU_ITEM_NUMBER,
  NEXT_ORDER_NUMBER,
  categories,
  createSeedOrders,
  menuItems,
} from '@/mocks/fixtures'
import type { MenuItemInput } from '@/types/api'
import type { Category, MenuItem, Order, OrderStatus } from '@/types/domain'

// In-memory store. Everything lives in module state, so a page reload (or `resetDb` in tests)
// starts again from the fixtures.
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

export function resetDb(): void {
  state = createState()
}

export interface MenuItemFilter {
  categoryId?: string
  q?: string
  includeUnavailable: boolean
}

export const db = {
  listCategories(): Category[] {
    return [...state.categories].sort((a, b) => a.sortOrder - b.sortOrder)
  },

  hasCategory(id: string): boolean {
    return state.categories.some((category) => category.id === id)
  },

  /** Grouped by category in the categories' order; within a category, in the order they were added. */
  listMenuItems(filter: MenuItemFilter): MenuItem[] {
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
    return state.menuItems.find((item) => item.id === id)
  },

  createMenuItem(input: MenuItemInput): MenuItem {
    const item: MenuItem = { id: `item-${String(state.nextMenuItemNumber)}`, ...input }
    state.nextMenuItemNumber += 1
    state.menuItems.push(item)
    return item
  },

  replaceMenuItem(id: string, input: MenuItemInput): MenuItem | undefined {
    const index = state.menuItems.findIndex((item) => item.id === id)
    if (index === -1) return undefined
    const item: MenuItem = { id, ...input }
    state.menuItems[index] = item
    return item
  },

  deleteMenuItem(id: string): boolean {
    const index = state.menuItems.findIndex((item) => item.id === id)
    if (index === -1) return false
    state.menuItems.splice(index, 1)
    return true
  },

  getOrder(id: string): Order | undefined {
    return state.orders.find((order) => order.id === id)
  },

  /** Newest first. Orders created in the same millisecond keep the later one first. */
  listOrders(status?: OrderStatus): Order[] {
    return state.orders
      .filter((order) => status === undefined || order.status === status)
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  createOrder(input: Pick<Order, 'lines' | 'fulfillment' | 'customer'>): Order {
    const order: Order = {
      id: `ord-${String(state.nextOrderNumber)}`,
      ...input,
      totalCents: input.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
      status: 'new',
      createdAt: new Date().toISOString(),
    }
    state.nextOrderNumber += 1
    state.orders.push(order)
    return order
  },

  setOrderStatus(id: string, status: OrderStatus): Order | undefined {
    const order = state.orders.find((candidate) => candidate.id === id)
    if (order === undefined) return undefined
    order.status = status
    return order
  },
}
