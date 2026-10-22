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

export function isTerminalStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0
}

const LABELS: Record<OrderStatus, string> = {
  new: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function statusLabel(status: OrderStatus): string {
  return LABELS[status]
}

/** The happy path a guest follows; `cancelled` is a way out of it, not a step. */
export const PROGRESS_STEPS = [
  'new',
  'preparing',
  'ready',
  'completed',
] as const satisfies readonly OrderStatus[]

const ACTION_LABELS: Record<OrderStatus, string> = {
  new: 'Reopen',
  preparing: 'Start preparing',
  ready: 'Mark as ready',
  completed: 'Mark as completed',
  cancelled: 'Cancel order',
}

/** What the button that moves an order to `to` says. */
export function transitionLabel(to: OrderStatus): string {
  return ACTION_LABELS[to]
}
