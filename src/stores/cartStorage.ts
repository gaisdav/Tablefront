import { MAX_NOTE_LENGTH, MAX_QUANTITY } from '@/domain/cart'
import { isRecord } from '@/domain/guards'
import type { CartLine } from '@/types/cart'

const STORAGE_KEY = 'tablefront:cart'

/** Bump when the shape of a saved cart changes; carts saved under another version are dropped. */
const SCHEMA_VERSION = 1

/** Accepts one saved line only if every field is what the app expects; otherwise it is dropped. */
function toCartLine(value: unknown): CartLine | null {
  if (!isRecord(value)) return null
  const { menuItemId, name, unitPriceCents, quantity, note } = value
  if (typeof menuItemId !== 'string' || menuItemId === '') return null
  if (typeof name !== 'string' || name === '') return null
  if (typeof unitPriceCents !== 'number' || !Number.isInteger(unitPriceCents) || unitPriceCents < 1)
    return null
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY
  )
    return null
  if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) return null
  return { menuItemId, name, unitPriceCents, quantity, note }
}

/**
 * Reads the saved cart. It never throws: storage that is blocked, unreadable, corrupt, from
 * another version or edited by hand all end up as "no cart" (or just the lines that are valid),
 * because a broken cart must not take the whole app down.
 */
export function loadCartLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const saved: unknown = JSON.parse(raw)
    if (!isRecord(saved) || saved.version !== SCHEMA_VERSION) return []
    const savedLines: unknown = saved.lines
    if (!Array.isArray(savedLines)) return []

    const lines: CartLine[] = []
    for (const entry of savedLines) {
      const line = toCartLine(entry)
      // One line per dish: a duplicate can only come from a damaged save.
      if (line !== null && !lines.some((kept) => kept.menuItemId === line.menuItemId))
        lines.push(line)
    }
    return lines
  } catch {
    return []
  }
}

/** Saves the cart. Storage that is full or blocked is not an error: the cart keeps working in memory. */
export function saveCartLines(lines: readonly CartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, lines }))
  } catch {
    // Quota exceeded, private mode, storage disabled: nothing useful to do.
  }
}
