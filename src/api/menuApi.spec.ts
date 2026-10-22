import { describe, expect, it } from 'vitest'
import { menuApi } from '@/api/menuApi'
import { menuItems } from '@/mocks/fixtures'
import { signInAsAdmin } from '@/test/helpers'

const availableCount = menuItems.filter((item) => item.available).length

describe('menuApi.listCategories', () => {
  it('returns categories sorted by sortOrder', async () => {
    const categories = await menuApi.listCategories()

    expect(categories.map((category) => category.name)).toEqual([
      'Starters',
      'Mains',
      'Desserts',
      'Drinks',
    ])
  })
})

describe('menuApi.listMenuItems', () => {
  it('hides unavailable items from guests', async () => {
    const items = await menuApi.listMenuItems()

    expect(items).toHaveLength(availableCount)
    expect(items.every((item) => item.available)).toBe(true)
  })

  it('shows unavailable items to an admin', async () => {
    await signInAsAdmin()

    const items = await menuApi.listMenuItems()

    expect(items).toHaveLength(menuItems.length)
    expect(items.filter((item) => !item.available).map((item) => item.name)).toEqual([
      'Lasagna',
      'Chocolate fondant',
    ])
  })

  it("lists dishes grouped by category, in the categories' order", async () => {
    const [items, categories] = await Promise.all([
      menuApi.listMenuItems(),
      menuApi.listCategories(),
    ])

    const order = categories.map((category) => category.id)
    const ranks = items.map((item) => order.indexOf(item.categoryId))

    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(ranks.every((rank) => rank >= 0)).toBe(true)
  })

  it('filters by category', async () => {
    const items = await menuApi.listMenuItems({ categoryId: 'cat-desserts' })

    expect(items.map((item) => item.name)).toEqual([
      'Tiramisu',
      'Schwarzwälder Kirschtorte',
      'Apfelstrudel',
    ])
  })

  it('matches the search text against names, case-insensitively', async () => {
    const items = await menuApi.listMenuItems({ q: 'PIZZA' })

    expect(items.map((item) => item.name)).toEqual(['Margherita pizza', 'Diavola pizza'])
  })

  it('matches the search text against descriptions', async () => {
    const items = await menuApi.listMenuItems({ q: 'guanciale' })

    expect(items.map((item) => item.name)).toEqual(['Spaghetti carbonara'])
  })

  it('combines category and search', async () => {
    const items = await menuApi.listMenuItems({ categoryId: 'cat-starters', q: 'pizza' })

    expect(items).toEqual([])
  })

  it('ignores an empty search', async () => {
    const items = await menuApi.listMenuItems({ q: '   ' })

    expect(items).toHaveLength(availableCount)
  })
})
