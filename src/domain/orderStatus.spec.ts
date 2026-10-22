import { describe, expect, it } from 'vitest'
import {
  allowedTransitions,
  canTransition,
  isStatusFor,
  isTerminalStatus,
  progressSteps,
  statusLabel,
  transitionLabel,
} from '@/domain/orderStatus'
import { ORDER_STATUSES, type Fulfillment, type OrderStatus } from '@/types/domain'

const FULFILLMENTS: Fulfillment[] = ['pickup', 'delivery']

describe('order status transitions', () => {
  it.each([
    ['pickup', 'new', 'preparing'],
    ['pickup', 'preparing', 'ready'],
    ['pickup', 'ready', 'completed'],
    ['pickup', 'new', 'cancelled'],
    ['pickup', 'preparing', 'cancelled'],
    ['delivery', 'new', 'preparing'],
    ['delivery', 'preparing', 'ready'],
    ['delivery', 'ready', 'out_for_delivery'],
    ['delivery', 'out_for_delivery', 'completed'],
    ['delivery', 'new', 'cancelled'],
    ['delivery', 'preparing', 'cancelled'],
  ] as const)('allows %s: %s -> %s', (fulfillment, from, to) => {
    expect(canTransition(from, to, fulfillment)).toBe(true)
  })

  it.each([
    ['pickup', 'new', 'ready'],
    ['pickup', 'new', 'completed'],
    ['pickup', 'preparing', 'new'],
    ['pickup', 'ready', 'cancelled'],
    ['pickup', 'ready', 'preparing'],
    ['pickup', 'ready', 'out_for_delivery'],
    ['pickup', 'completed', 'cancelled'],
    ['pickup', 'cancelled', 'new'],
    ['delivery', 'new', 'ready'],
    ['delivery', 'ready', 'completed'],
    ['delivery', 'ready', 'cancelled'],
    ['delivery', 'preparing', 'out_for_delivery'],
    ['delivery', 'out_for_delivery', 'cancelled'],
    ['delivery', 'out_for_delivery', 'ready'],
    ['delivery', 'completed', 'out_for_delivery'],
  ] as const)('rejects %s: %s -> %s', (fulfillment, from, to) => {
    expect(canTransition(from, to, fulfillment)).toBe(false)
  })

  it('never allows a status to transition to itself', () => {
    for (const fulfillment of FULFILLMENTS) {
      for (const status of ORDER_STATUSES) {
        expect(canTransition(status, status, fulfillment)).toBe(false)
      }
    }
  })

  it('treats completed and cancelled as terminal for both', () => {
    for (const fulfillment of FULFILLMENTS) {
      expect(allowedTransitions('completed', fulfillment)).toEqual([])
      expect(allowedTransitions('cancelled', fulfillment)).toEqual([])
    }
  })

  it('lists exactly the targets canTransition accepts', () => {
    for (const fulfillment of FULFILLMENTS) {
      for (const from of ORDER_STATUSES) {
        const accepted = ORDER_STATUSES.filter((to) => canTransition(from, to, fulfillment))
        expect(allowedTransitions(from, fulfillment)).toEqual(accepted)
      }
    }
  })

  it('has exactly one way out of "ready", which depends on how the order is received', () => {
    expect(allowedTransitions('ready', 'pickup')).toEqual(['completed'])
    expect(allowedTransitions('ready', 'delivery')).toEqual(['out_for_delivery'])
  })

  it('never moves a pickup into "on the way", from anywhere', () => {
    for (const from of ORDER_STATUSES) {
      expect(allowedTransitions(from, 'pickup')).not.toContain('out_for_delivery')
    }
  })

  it('lets every status be reached on the way to "completed"', () => {
    // From "new" a delivery and a pickup can each walk to the end, one allowed step at a time.
    for (const fulfillment of FULFILLMENTS) {
      let status: OrderStatus = 'new'
      const visited: string[] = [status]
      while (!isTerminalStatus(status)) {
        const next: OrderStatus | undefined = allowedTransitions(status, fulfillment).find(
          (to) => to !== 'cancelled',
        )
        if (next === undefined) break
        status = next
        visited.push(status)
      }
      expect(visited).toEqual(progressSteps(fulfillment))
    }
  })
})

describe('which statuses an order can have', () => {
  it('lets only a delivery be on the way', () => {
    expect(isStatusFor('delivery', 'out_for_delivery')).toBe(true)
    expect(isStatusFor('pickup', 'out_for_delivery')).toBe(false)
  })

  it('lets both have every other status', () => {
    for (const status of ORDER_STATUSES.filter((s) => s !== 'out_for_delivery')) {
      expect(isStatusFor('pickup', status)).toBe(true)
      expect(isStatusFor('delivery', status)).toBe(true)
    }
  })
})

describe('order status presentation', () => {
  it('treats exactly the statuses with no way forward as terminal', () => {
    expect(ORDER_STATUSES.filter(isTerminalStatus)).toEqual(['completed', 'cancelled'])
  })

  it('has a label for every status', () => {
    expect(ORDER_STATUSES.map(statusLabel)).toEqual([
      'Received',
      'Preparing',
      'Ready',
      'On the way',
      'Completed',
      'Cancelled',
    ])
  })

  it('has a button label for every status, "Out for delivery" for the new one', () => {
    expect(transitionLabel('out_for_delivery')).toBe('Out for delivery')
    for (const status of ORDER_STATUSES) expect(transitionLabel(status)).not.toBe('')
  })

  it('shows the happy path as the steps, without cancelled, with one more step for a delivery', () => {
    expect(progressSteps('pickup')).toEqual(['new', 'preparing', 'ready', 'completed'])
    expect(progressSteps('delivery')).toEqual([
      'new',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
    ])
  })
})
