import { describe, expect, it } from 'vitest'
import { categories, createSeedOrders, menuItems } from '@/mocks/fixtures'

describe('fixtures', () => {
  it('match the size the spec asks for', () => {
    expect(categories).toHaveLength(4)
    expect(menuItems.length).toBeGreaterThanOrEqual(16)
    expect(menuItems.length).toBeLessThanOrEqual(20)
    expect(createSeedOrders(new Date()).length).toBeGreaterThanOrEqual(6)
    expect(createSeedOrders(new Date()).length).toBeLessThanOrEqual(8)
  })

  it('use unique ids', () => {
    const ids = [...categories, ...menuItems, ...createSeedOrders(new Date())].map(
      (entry) => entry.id,
    )

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('put every dish in an existing category', () => {
    const categoryIds = new Set(categories.map((category) => category.id))

    expect(menuItems.filter((item) => !categoryIds.has(item.categoryId))).toEqual([])
  })

  it('cover every state the UI has to show: sold out, no image, no allergens', () => {
    expect(menuItems.some((item) => !item.available)).toBe(true)
    expect(menuItems.some((item) => item.imageUrl === null)).toBe(true)
    expect(menuItems.some((item) => item.allergens.length === 0)).toBe(true)
  })

  it('store prices as whole cents', () => {
    expect(menuItems.filter((item) => !Number.isInteger(item.priceCents))).toEqual([])
  })

  it('seed orders that refer to real dishes, with consistent totals and a mix of statuses', () => {
    const orders = createSeedOrders(new Date())
    const itemIds = new Set(menuItems.map((item) => item.id))

    for (const order of orders) {
      expect(order.lines.every((line) => itemIds.has(line.menuItemId))).toBe(true)
      expect(order.totalCents).toBe(
        order.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
      )
    }
    expect(new Set(orders.map((order) => order.status)).size).toBe(5)
  })
})
