/** Money is always an integer number of cents; format only at the edge with `formatCents`. */
export type Cents = number

export interface Category {
  id: string
  name: string
  sortOrder: number
}

export type Allergen =
  'gluten' | 'dairy' | 'nuts' | 'eggs' | 'soy' | 'fish' | 'shellfish' | 'sesame'

export interface MenuItem {
  id: string
  name: string
  description: string
  priceCents: Cents
  categoryId: string
  imageUrl: string | null
  available: boolean
  allergens: Allergen[]
}

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export type Fulfillment = 'pickup' | 'delivery'

/** Name and price are snapshots taken when the order was placed. */
export interface OrderLine {
  menuItemId: string
  name: string
  unitPriceCents: Cents
  quantity: number
  note?: string
}

export interface Customer {
  name: string
  phone: string
  address?: string
}

export interface Order {
  id: string
  lines: OrderLine[]
  totalCents: Cents
  status: OrderStatus
  fulfillment: Fulfillment
  customer: Customer
  /** ISO 8601 */
  createdAt: string
}
