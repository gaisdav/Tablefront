import { http } from '@/api/client'
import type { CreateOrderRequest } from '@/types/api'
import type { Order } from '@/types/domain'

export const ordersApi = {
  createOrder(request: CreateOrderRequest): Promise<Order> {
    return http.post<Order>('/orders', { body: request })
  },

  getOrder(id: string, signal?: AbortSignal): Promise<Order> {
    return http.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal })
  },
}
