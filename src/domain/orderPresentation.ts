import type { OrderLine } from '@/types/domain'

const placedAtFormat = new Intl.DateTimeFormat('en-IE', { dateStyle: 'medium', timeStyle: 'short' })

/** "22 Oct 2026, 14:05"; an unreadable timestamp gives an empty string instead of "Invalid Date". */
export function formatPlacedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : placedAtFormat.format(date)
}

/** "2× Margherita pizza, Weissbier and 3 more": enough to recognise an order at a glance. */
export function summarizeLines(lines: readonly OrderLine[], shown = 2): string {
  const parts = lines.map((line) =>
    line.quantity === 1 ? line.name : `${String(line.quantity)}× ${line.name}`,
  )
  if (parts.length <= shown) return parts.join(', ')
  const rest = parts.length - shown
  return `${parts.slice(0, shown).join(', ')} and ${String(rest)} more`
}
