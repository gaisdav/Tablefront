import { describe, expect, it } from 'vitest'
import {
  allowedTransitions,
  canTransition,
  isTerminalStatus,
  PROGRESS_STEPS,
  statusLabel,
} from '@/domain/orderStatus'
import type { OrderStatus } from '@/types/domain'

const ALL: OrderStatus[] = ['new', 'preparing', 'ready', 'completed', 'cancelled']

describe('order status transitions', () => {
  it.each([
    ['new', 'preparing'],
    ['preparing', 'ready'],
    ['ready', 'completed'],
    ['new', 'cancelled'],
    ['preparing', 'cancelled'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it.each([
    ['new', 'ready'],
    ['new', 'completed'],
    ['preparing', 'new'],
    ['ready', 'cancelled'],
    ['ready', 'preparing'],
    ['completed', 'cancelled'],
    ['cancelled', 'new'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })

  it('never allows a status to transition to itself', () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it('treats completed and cancelled as terminal', () => {
    expect(allowedTransitions('completed')).toEqual([])
    expect(allowedTransitions('cancelled')).toEqual([])
  })

  it('lists exactly the targets canTransition accepts', () => {
    for (const from of ALL) {
      const accepted = ALL.filter((to) => canTransition(from, to))
      expect(allowedTransitions(from)).toEqual(accepted)
    }
  })
})

describe('order status presentation', () => {
  it('treats exactly the statuses with no way forward as terminal', () => {
    expect(ALL.filter(isTerminalStatus)).toEqual(['completed', 'cancelled'])
  })

  it('has a label for every status', () => {
    expect(ALL.map(statusLabel)).toEqual([
      'Received',
      'Preparing',
      'Ready',
      'Completed',
      'Cancelled',
    ])
  })

  it('shows the happy path as the steps, without cancelled', () => {
    expect(PROGRESS_STEPS).toEqual(['new', 'preparing', 'ready', 'completed'])
  })
})
