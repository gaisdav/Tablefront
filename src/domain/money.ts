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
