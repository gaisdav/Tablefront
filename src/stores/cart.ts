import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { lineTotalCents, MAX_NOTE_LENGTH, MAX_QUANTITY } from '@/domain/cart'
import { loadCartLines, saveCartLines } from '@/stores/cartStorage'
import type { CartLine, CartNotice } from '@/types/cart'
import type { MenuItem } from '@/types/domain'

function clampQuantity(quantity: number): number {
  return Math.min(MAX_QUANTITY, Math.max(0, Math.trunc(quantity)))
}

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>(loadCartLines())
  const notices = ref<CartNotice[]>([])
  let nextNoticeId = 1

  const itemCount = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
  const subtotalCents = computed(() =>
    lines.value.reduce((sum, line) => sum + lineTotalCents(line), 0),
  )
  const isEmpty = computed(() => lines.value.length === 0)

  function quantityOf(menuItemId: string): number {
    return lines.value.find((line) => line.menuItemId === menuItemId)?.quantity ?? 0
  }

  /** Adds `quantity` of a dish. Adding it again increases the quantity; the price is the latest one. */
  function add(item: MenuItem, quantity = 1): void {
    if (!item.available || Number.isNaN(quantity)) return
    const existing = lines.value.find((line) => line.menuItemId === item.id)
    if (existing === undefined) {
      const amount = clampQuantity(quantity)
      if (amount > 0) {
        lines.value.push({
          menuItemId: item.id,
          name: item.name,
          unitPriceCents: item.priceCents,
          quantity: amount,
          note: '',
        })
      }
      return
    }
    if (existing.unitPriceCents !== item.priceCents) {
      // The earlier units are repriced too, so say so instead of changing the total silently.
      notices.value.push({
        id: nextNoticeId++,
        kind: 'price-changed',
        name: item.name,
        fromCents: existing.unitPriceCents,
        toCents: item.priceCents,
      })
    }
    existing.quantity = clampQuantity(existing.quantity + quantity)
    existing.name = item.name
    existing.unitPriceCents = item.priceCents
  }

  /** Sets the quantity; zero or less removes the line. */
  function setQuantity(menuItemId: string, quantity: number): void {
    const line = lines.value.find((candidate) => candidate.menuItemId === menuItemId)
    // NaN would survive Math.max/min and poison every total, so it is not a quantity at all.
    if (line === undefined || Number.isNaN(quantity)) return
    const amount = clampQuantity(quantity)
    if (amount === 0) remove(menuItemId)
    else line.quantity = amount
  }

  function setNote(menuItemId: string, note: string): void {
    const line = lines.value.find((candidate) => candidate.menuItemId === menuItemId)
    if (line !== undefined) line.note = note.slice(0, MAX_NOTE_LENGTH)
  }

  function remove(menuItemId: string): void {
    lines.value = lines.value.filter((line) => line.menuItemId !== menuItemId)
  }

  function clear(): void {
    lines.value = []
  }

  /**
   * Brings the cart in line with the current menu (the dishes guests can order right now).
   * A dish that is gone or sold out is removed, a changed price is updated, and each of those is
   * recorded as a notice so the user is told rather than finding out at checkout.
   */
  function reconcile(menu: readonly MenuItem[]): void {
    // An empty menu is far more likely a backend hiccup than "everything sold out"; removing the
    // whole cart on that evidence would lose the guest's order.
    if (menu.length === 0) return
    const current = new Map(menu.map((item) => [item.id, item]))
    const reconciled: CartLine[] = []
    let changed = false

    for (const line of lines.value) {
      const item = current.get(line.menuItemId)
      if (item === undefined || !item.available) {
        notices.value.push({ id: nextNoticeId++, kind: 'removed', name: line.name })
        changed = true
      } else if (item.priceCents !== line.unitPriceCents) {
        notices.value.push({
          id: nextNoticeId++,
          kind: 'price-changed',
          name: item.name,
          fromCents: line.unitPriceCents,
          toCents: item.priceCents,
        })
        reconciled.push({ ...line, name: item.name, unitPriceCents: item.priceCents })
        changed = true
      } else {
        reconciled.push(item.name === line.name ? line : { ...line, name: item.name })
        changed ||= item.name !== line.name
      }
    }
    if (changed) lines.value = reconciled
  }

  function dismissNotice(id: number): void {
    notices.value = notices.value.filter((notice) => notice.id !== id)
  }

  // Side effect: keep the saved copy in step with the cart.
  watch(
    lines,
    (value) => {
      saveCartLines(value)
    },
    { deep: true },
  )

  return {
    lines,
    notices,
    itemCount,
    subtotalCents,
    isEmpty,
    quantityOf,
    add,
    setQuantity,
    setNote,
    remove,
    clear,
    reconcile,
    dismissNotice,
  }
})
