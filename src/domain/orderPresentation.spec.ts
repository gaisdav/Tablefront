import { describe, expect, it } from 'vitest'
import { formatPlacedAt, summarizeLines } from '@/domain/orderPresentation'
import type { OrderLine } from '@/types/domain'

const line = (name: string, quantity: number): OrderLine => ({
  menuItemId: name,
  name,
  unitPriceCents: 100,
  quantity,
})

describe('summarizeLines', () => {
  it('lists a few lines, with the quantity only when it is more than one', () => {
    expect(summarizeLines([line('Margherita pizza', 2), line('Weissbier', 1)])).toBe(
      '2× Margherita pizza, Weissbier',
    )
  })

  it('says how many more there are when the list is long', () => {
    const lines = ['A', 'B', 'C', 'D', 'E'].map((name) => line(name, 1))

    expect(summarizeLines(lines)).toBe('A, B and 3 more')
    expect(summarizeLines(lines, 4)).toBe('A, B, C, D and 1 more')
  })

  it('is empty for no lines', () => {
    expect(summarizeLines([])).toBe('')
  })
})

describe('formatPlacedAt', () => {
  it('writes a date and a time a person can read', () => {
    expect(formatPlacedAt('2026-10-22T14:05:00.000Z')).toMatch(/2026/)
    expect(formatPlacedAt('2026-10-22T14:05:00.000Z')).toMatch(/\d{1,2}:\d{2}/)
  })

  it('gives nothing, not "Invalid Date", for an unreadable timestamp', () => {
    expect(formatPlacedAt('yesterday')).toBe('')
    expect(formatPlacedAt('')).toBe('')
  })
})
