import type { Fulfillment, OrderStatus } from '@/types/domain'

// Single source of truth for the order lifecycle: the UI uses it to decide which buttons to
// render and the mock API uses it to reject invalid transitions with 409.
//
// The way out of "ready" depends on how the order is received: a pickup is collected, a delivery
// goes out with a courier first ("out for delivery" exists only for deliveries). Nothing can be
// cancelled once the food is ready: it is made, or on its way.
const TRANSITIONS: Record<Fulfillment, Record<OrderStatus, readonly OrderStatus[]>> = {
  pickup: {
    new: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed'],
    out_for_delivery: [],
    completed: [],
    cancelled: [],
  },
  delivery: {
    new: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['out_for_delivery'],
    out_for_delivery: ['completed'],
    completed: [],
    cancelled: [],
  },
}

/** What an order in `from`, received as `fulfillment`, can move to next. */
export function allowedTransitions(
  from: OrderStatus,
  fulfillment: Fulfillment,
): readonly OrderStatus[] {
  return TRANSITIONS[fulfillment][from]
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: Fulfillment,
): boolean {
  return TRANSITIONS[fulfillment][from].includes(to)
}

/** Whether an order received this way can ever have this status (a pickup is never "on the way"). */
export function isStatusFor(fulfillment: Fulfillment, status: OrderStatus): boolean {
  return fulfillment === 'delivery' || status !== 'out_for_delivery'
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled'
}

const LABELS: Record<OrderStatus, string> = {
  new: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function statusLabel(status: OrderStatus): string {
  return LABELS[status]
}

/** The happy path a guest follows; `cancelled` is a way out of it, not a step. */
export function progressSteps(fulfillment: Fulfillment): readonly OrderStatus[] {
  return fulfillment === 'delivery'
    ? ['new', 'preparing', 'ready', 'out_for_delivery', 'completed']
    : ['new', 'preparing', 'ready', 'completed']
}

const ACTION_LABELS: Record<OrderStatus, string> = {
  new: 'Reopen',
  preparing: 'Start preparing',
  ready: 'Mark as ready',
  out_for_delivery: 'Out for delivery',
  completed: 'Mark as completed',
  cancelled: 'Cancel order',
}

/** What the button that moves an order to `to` says. */
export function transitionLabel(to: OrderStatus): string {
  return ACTION_LABELS[to]
}
