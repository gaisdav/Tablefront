import { describe, expect, it } from 'vitest'
import { formatCents } from '@/domain/money'

describe('formatCents', () => {
  it('formats whole and fractional amounts', () => {
    expect(formatCents(1250)).toBe('€12.50')
    expect(formatCents(5)).toBe('€0.05')
    expect(formatCents(0)).toBe('€0.00')
  })

  it('groups thousands', () => {
    expect(formatCents(123456789)).toBe('€1,234,567.89')
  })

  it('formats negative amounts', () => {
    expect(formatCents(-250)).toBe('-€2.50')
  })

  it('rejects non-integer cents', () => {
    expect(() => formatCents(10.5)).toThrow(RangeError)
    expect(() => formatCents(Number.NaN)).toThrow(RangeError)
  })
})
