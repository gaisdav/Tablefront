import { isRecord } from '@/domain/guards'

const STORAGE_KEY = 'tablefront:orders'

/** Bump when the shape of the saved list changes; a list saved under another version is dropped. */
const SCHEMA_VERSION = 1

/** Orders beyond this are forgotten, oldest first: the list is a convenience, not an archive. */
export const MAX_REMEMBERED_ORDERS = 50

/**
 * Reads the ids of the orders placed in this browser, newest first. It never throws: blocked,
 * unreadable, corrupt, foreign-version or hand-edited storage all end up as "none" (or just the ids
 * that are valid), because a broken list must not take the page down.
 */
export function loadOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const saved: unknown = JSON.parse(raw)
    if (!isRecord(saved) || saved.version !== SCHEMA_VERSION) return []
    const savedIds: unknown = saved.ids
    if (!Array.isArray(savedIds)) return []

    const ids: string[] = []
    for (const id of savedIds) {
      if (typeof id === 'string' && id !== '' && !ids.includes(id)) ids.push(id)
    }
    return ids.slice(0, MAX_REMEMBERED_ORDERS)
  } catch {
    return []
  }
}

/** Saves the list. Storage that is full or blocked is not an error: it keeps working in memory. */
export function saveOrderIds(ids: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, ids }))
  } catch {
    // Quota exceeded, private mode, storage disabled: nothing useful to do.
  }
}
