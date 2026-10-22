import type { Customer, Fulfillment, MenuItem, OrderLine, OrderStatus } from '@/types/domain'

/** The one error shape every endpoint returns. `fields` is set on 422 (field name -> message). */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
}

export type MenuItemsQuery = {
  categoryId?: string
  /** Case-insensitive match on name and description. */
  q?: string
}

/** The server looks up names and prices itself, so lines only say what and how many. */
export type CreateOrderLine = Pick<OrderLine, 'menuItemId' | 'quantity' | 'note'>

export interface CreateOrderRequest {
  lines: CreateOrderLine[]
  fulfillment: Fulfillment
  customer: Customer
}

export type AdminOrdersQuery = {
  status?: OrderStatus
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus
}

export type MenuItemInput = Omit<MenuItem, 'id'>
