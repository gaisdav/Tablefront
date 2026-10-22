import { describe, expect, it } from 'vitest'
import { centsToInput, formatCents, parseMoneyToCents } from '@/domain/money'

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

describe('parseMoneyToCents', () => {
  it.each([
    ['11', 1100],
    ['11.5', 1150],
    ['11.50', 1150],
    ['11,50', 1150],
    ['0.05', 5],
    ['0,5', 50],
    ['  7.00 ', 700],
    ['19.99', 1999],
    ['0', 0],
    ['1234567.89', 123456789],
  ])('reads %j as %i cents', (text, cents) => {
    expect(parseMoneyToCents(text)).toBe(cents)
  })

  it.each([
    '',
    'abc',
    '1.234',
    '1..5',
    '-3',
    '1,000.50',
    '€5',
    '5 €',
    '.5',
    '5.',
    '12345678',
    '1e3',
  ])('rejects %j', (text) => {
    expect(parseMoneyToCents(text)).toBeNull()
  })

  it('never goes through floating point: 19.99 is exactly 1999', () => {
    expect(parseMoneyToCents('19.99')).toBe(1999)
    expect(parseMoneyToCents('0.29')).toBe(29)
    expect(parseMoneyToCents('1.15')).toBe(115)
  })
})

describe('centsToInput', () => {
  it.each([
    [1100, '11.00'],
    [1150, '11.50'],
    [5, '0.05'],
    [0, '0.00'],
    [123456, '1234.56'],
  ])('shows %i cents as %j', (cents, text) => {
    expect(centsToInput(cents)).toBe(text)
  })

  it('round-trips with parseMoneyToCents', () => {
    for (const cents of [1, 99, 100, 101, 1999, 250000]) {
      expect(parseMoneyToCents(centsToInput(cents))).toBe(cents)
    }
  })

  it.each([1.5, -1, Number.NaN])('refuses %s: not whole non-negative cents', (cents) => {
    expect(() => centsToInput(cents)).toThrow(RangeError)
  })
})
