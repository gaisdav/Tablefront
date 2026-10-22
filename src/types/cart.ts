import type { Cents } from '@/types/domain'

/**
 * One dish in the cart. Name and price are a snapshot taken when it was added, so the cart can
 * be shown without a request, and compared with the live menu to notice that a price changed.
 */
export interface CartLine {
  menuItemId: string
  name: string
  unitPriceCents: Cents
  quantity: number
  note: string
}

/** Something that changed in the cart without the user doing it, which they should be told. */
export type CartNotice =
  | { id: number; kind: 'removed'; name: string }
  | { id: number; kind: 'price-changed'; name: string; fromCents: Cents; toCents: Cents }
