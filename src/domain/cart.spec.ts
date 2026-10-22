import { describe, expect, it } from 'vitest'
import { describeCartChange, lineTotalCents } from '@/domain/cart'
import type { CartLine } from '@/types/cart'

function line(
  menuItemId: string,
  name: string,
  unitPriceCents: number,
  quantity: number,
): CartLine {
  return { menuItemId, name, unitPriceCents, quantity, note: '' }
}

const pizza = line('item-5', 'Margherita pizza', 1100, 1)
const lemonade = line('item-17', 'Lemonade', 450, 1)

describe('lineTotalCents', () => {
  it('multiplies the unit price by the quantity, in whole cents', () => {
    expect(lineTotalCents(line('a', 'A', 1100, 3))).toBe(3300)
  })
})

describe('describeCartChange', () => {
  it('announces an added dish with the new total', () => {
    expect(describeCartChange([], [pizza])).toBe('Added Margherita pizza. Cart total €11.00.')
  })

  it('announces a changed quantity', () => {
    expect(describeCartChange([pizza], [{ ...pizza, quantity: 3 }])).toBe(
      'Margherita pizza: 3 in cart. Cart total €33.00.',
    )
  })

  it('announces a removed dish and an emptied cart', () => {
    expect(describeCartChange([pizza], [])).toBe('Removed Margherita pizza. Your cart is empty.')
  })

  it('announces a removal that leaves other dishes', () => {
    expect(describeCartChange([pizza, lemonade], [lemonade])).toBe(
      'Removed Margherita pizza. Cart total €4.50.',
    )
  })

  it('stays silent when nothing changed', () => {
    expect(describeCartChange([pizza], [pizza])).toBeNull()
  })

  it('stays silent for a note edit, which is not an event worth interrupting for', () => {
    expect(describeCartChange([pizza], [{ ...pizza, note: 'Extra basil' }])).toBeNull()
  })

  it('stays silent when several lines changed at once (a reconciliation, announced as notices)', () => {
    expect(describeCartChange([pizza, lemonade], [])).toBeNull()
  })
})
