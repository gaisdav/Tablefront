import { FULFILLMENTS, type Fulfillment, type OrderStatus } from '@/types/domain'

// Single source of truth for the order lifecycle: the UI uses it to decide which buttons to
// render, the guest stepper where the order is, and the mock API to reject invalid transitions
// with 409. Everything else about statuses is derived from it.
//
// The way out of "ready" depends on how the order is received: a pickup is collected, a delivery
// goes out with a courier first ("out for delivery" exists only for deliveries: a status that is
// missing from a fulfillment's table does not exist for it). Nothing can be cancelled once the
// food is ready: it is made, or on its way. The forward move is always listed first, so the
// happy path is the first move from each status.
type Lifecycle = Partial<Record<OrderStatus, readonly OrderStatus[]>>

const TRANSITIONS: Record<Fulfillment, Lifecycle> = {
  pickup: {
    new: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed'],
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
  return TRANSITIONS[fulfillment][from] ?? []
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: Fulfillment,
): boolean {
  return allowedTransitions(from, fulfillment).includes(to)
}

/** Whether an order received this way can ever have this status (a pickup is never "on the way"). */
export function isStatusFor(fulfillment: Fulfillment, status: OrderStatus): boolean {
  return status in TRANSITIONS[fulfillment]
}

/** No way forward for any order, however it is received (a status an order cannot have has no moves). */
export function isTerminalStatus(status: OrderStatus): boolean {
  return FULFILLMENTS.every((fulfillment) => allowedTransitions(status, fulfillment).length === 0)
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

/** The happy path a guest follows, from the first status along each first move; `cancelled` is a way out of it, not a step. */
export function progressSteps(fulfillment: Fulfillment): readonly OrderStatus[] {
  const steps: OrderStatus[] = ['new']
  for (;;) {
    const last = steps[steps.length - 1]
    const next = last === undefined ? undefined : allowedTransitions(last, fulfillment)[0]
    if (next === undefined) return steps
    steps.push(next)
  }
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
