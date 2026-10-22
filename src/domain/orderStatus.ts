import type { OrderStatus } from '@/types/domain'

// Single source of truth for the order lifecycle: the UI uses it to decide which buttons to
// render and the mock API uses it to reject invalid transitions with 409.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from]
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
