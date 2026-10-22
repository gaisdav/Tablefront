import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import AdminMenuList from '@/components/admin/AdminMenuList.vue'
import { setViewport } from '@/test/media'
import type { Category, MenuItem } from '@/types/domain'

const categories: Category[] = [
  { id: 'cat-mains', name: 'Mains', sortOrder: 2 },
  { id: 'cat-drinks', name: 'Drinks', sortOrder: 4 },
]

const items: MenuItem[] = [
  {
    id: 'item-5',
    name: 'Margherita pizza',
    description: 'Tomato and basil.',
    priceCents: 1150,
    categoryId: 'cat-mains',
    imageUrl: null,
    available: true,
    allergens: [],
  },
  {
    id: 'item-8',
    name: 'Lasagna',
    description: 'Layers.',
    priceCents: 1500,
    categoryId: 'cat-gone',
    imageUrl: null,
    available: false,
    allergens: [],
  },
]

function mountList(wide: boolean, saving: string[] = []) {
  setViewport(wide)
  return mount(AdminMenuList, { props: { items, categories, saving: new Set(saving) } })
}

afterEach(() => {
  setViewport(false)
})

describe('AdminMenuList: wide', () => {
  it('is a table with a header, one row per dish, the price formatted and the category named', () => {
    const wrapper = mountList(true)

    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual([
      'Dish',
      'Category',
      'Price',
      'Available',
      'Actions',
    ])
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Margherita pizza')
    expect(rows[0]?.text()).toContain('Mains')
    expect(rows[0]?.text()).toContain('€11.50')
    expect(rows[1]?.text()).toContain('—') // a category that no longer exists
    expect(wrapper.find('ul').exists()).toBe(false)
  })
})

describe('AdminMenuList: narrow', () => {
  it('is a list of cards instead, with the same information', () => {
    const wrapper = mountList(false)

    expect(wrapper.find('table').exists()).toBe(false)
    const cards = wrapper.findAll('li.card')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.text()).toContain('Margherita pizza')
    expect(cards[0]?.text()).toContain('€11.50')
    expect(cards[0]?.text()).toContain('Available')
    expect(cards[1]?.text()).toContain('Sold out')
  })
})

describe.each([
  ['wide', true],
  ['narrow', false],
])('AdminMenuList: the controls (%s)', (_label, wide) => {
  it('has an availability switch per dish that shows its state and asks for the opposite', async () => {
    const wrapper = mountList(wide)
    const switches = wrapper.findAll('[role="switch"]')

    expect(switches.map((s) => s.attributes('aria-checked'))).toEqual(['true', 'false'])
    expect(switches[0]?.attributes('aria-label')).toBe('Margherita pizza available')
    await switches[0]?.trigger('click')
    await switches[1]?.trigger('click')

    expect(wrapper.emitted('set-available')).toEqual([
      [items[0], false],
      [items[1], true],
    ])
  })

  it('marks the switch of a dish that is being saved as busy', () => {
    const wrapper = mountList(wide, ['item-8'])

    expect(wrapper.findAll('[role="switch"]').map((s) => s.attributes('aria-busy'))).toEqual([
      undefined,
      'true',
    ])
  })

  it('has Edit and Delete named after the dish, which emit the dish', async () => {
    const wrapper = mountList(wide)

    await wrapper.get('[aria-label="Edit Lasagna"]').trigger('click')
    await wrapper.get('[aria-label="Delete Margherita pizza"]').trigger('click')

    expect(wrapper.emitted('edit')).toEqual([[items[1]]])
    expect(wrapper.emitted('delete')).toEqual([[items[0]]])
  })
})
