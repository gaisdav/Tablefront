import type { Cents } from '@/types/domain'

const LOCALE = 'en-IE'
const CURRENCY = 'EUR'

const formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY })

export function formatCents(cents: Cents): string {
  // A fractional value means somebody did float math on money; fail instead of showing a wrong price.
  if (!Number.isInteger(cents)) {
    throw new RangeError(`Expected integer cents, got ${String(cents)}`)
  }
  return formatter.format(cents / 100)
}

/**
 * Reads a price typed in euros ("11", "11.5", "11,50") into whole cents, or null if it is not one.
 * Done on the text, not with floating point, so 19.99 can never become 1998.999….
 */
export function parseMoneyToCents(text: string): Cents | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (match === null) return null
  const [, euros = '', fraction = ''] = match
  return Number(euros) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Cents as the plain number an input shows ("1100" -> "11.00"), without a currency symbol. */
export function centsToInput(cents: Cents): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`Expected non-negative integer cents, got ${String(cents)}`)
  }
  return `${String(Math.trunc(cents / 100))}.${String(cents % 100).padStart(2, '0')}`
}
