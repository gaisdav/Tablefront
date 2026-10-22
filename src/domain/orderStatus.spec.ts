import { describe, expect, it } from 'vitest'
import { allowedTransitions, canTransition } from '@/domain/orderStatus'
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
