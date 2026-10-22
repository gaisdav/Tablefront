import { describe, expect, it } from 'vitest'
import { menuApi } from '@/api/menuApi'
import { signInAsAdmin } from '@/test/helpers'

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

    expect(items).toHaveLength(17)
    expect(items.every((item) => item.available)).toBe(true)
  })

  it('shows unavailable items to an admin', async () => {
    await signInAsAdmin()

    const items = await menuApi.listMenuItems()

    expect(items).toHaveLength(19)
    expect(items.filter((item) => !item.available).map((item) => item.name)).toEqual([
      'Lasagna',
      'Chocolate fondant',
    ])
  })

  it('filters by category', async () => {
    const items = await menuApi.listMenuItems({ categoryId: 'cat-desserts' })

    expect(items.map((item) => item.name)).toEqual(['Tiramisu', 'Panna cotta', 'Pistachio gelato'])
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

    expect(items).toHaveLength(17)
  })
})
