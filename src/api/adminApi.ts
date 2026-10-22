import { http } from '@/api/client'
import type { AdminOrdersQuery, MenuItemInput, UpdateOrderStatusRequest } from '@/types/api'
import type { MenuItem, Order, OrderStatus } from '@/types/domain'

export const adminApi = {
  listOrders(query: AdminOrdersQuery = {}, signal?: AbortSignal): Promise<Order[]> {
    return http.get<Order[]>('/admin/orders', { query, signal })
  },

  updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const body: UpdateOrderStatusRequest = { status }
    return http.patch<Order>(`/admin/orders/${encodeURIComponent(id)}/status`, { body })
  },

  createMenuItem(input: MenuItemInput): Promise<MenuItem> {
    return http.post<MenuItem>('/admin/menu-items', { body: input })
  },

  updateMenuItem(id: string, input: MenuItemInput): Promise<MenuItem> {
    return http.put<MenuItem>(`/admin/menu-items/${encodeURIComponent(id)}`, { body: input })
  },

  deleteMenuItem(id: string): Promise<void> {
    return http.delete(`/admin/menu-items/${encodeURIComponent(id)}`)
  },
}
