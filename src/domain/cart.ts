import { formatCents } from '@/domain/money'
import type { CartLine, CartNotice } from '@/types/cart'
import type { Cents } from '@/types/domain'

// The same limits the API enforces, so the cart never builds an order the server would reject.
export const MAX_QUANTITY = 99
export const MAX_NOTE_LENGTH = 200

export function lineTotalCents(line: CartLine): Cents {
  return line.unitPriceCents * line.quantity
}

/**
 * Words for a screen reader describing what just happened to the cart, or null when the change is
 * not a single, clear action (several lines at once, which is a reconciliation the user is told
 * about separately).
 */
export function describeCartChange(
  before: readonly CartLine[],
  after: readonly CartLine[],
): string | null {
  const total = after.reduce((sum, line) => sum + lineTotalCents(line), 0)
  const summary = after.length === 0 ? 'Your cart is empty.' : `Cart total ${formatCents(total)}.`

  const added = after.filter((line) => !before.some((old) => old.menuItemId === line.menuItemId))
  const removed = before.filter((old) => !after.some((line) => line.menuItemId === old.menuItemId))
  const changed = after.filter((line) => {
    const old = before.find((candidate) => candidate.menuItemId === line.menuItemId)
    return old !== undefined && old.quantity !== line.quantity
  })

  if (added.length + removed.length + changed.length !== 1) return null
  const [addedLine] = added
  if (addedLine !== undefined) return `Added ${addedLine.name}. ${summary}`
  const [removedLine] = removed
  if (removedLine !== undefined) return `Removed ${removedLine.name}. ${summary}`
  const [changedLine] = changed
  return changedLine === undefined
    ? null
    : `${changedLine.name}: ${String(changedLine.quantity)} in cart. ${summary}`
}

/** What happened to the cart without the user doing it, in a sentence. */
export function describeNotice(notice: CartNotice): string {
  return notice.kind === 'removed'
    ? `${notice.name} is no longer available and was removed from your cart.`
    : `${notice.name} now costs ${formatCents(notice.toCents)} (was ${formatCents(notice.fromCents)}).`
}
