import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MenuItemCard from '@/components/menu/MenuItemCard.vue'
import type { MenuItem } from '@/types/domain'

const item: MenuItem = {
  id: 'item-5',
  name: 'Margherita pizza',
  description: 'Tomato, fior di latte and basil.',
  priceCents: 1100,
  categoryId: 'cat-mains',
  imageUrl: 'https://example.test/margherita.jpg',
  available: true,
  allergens: ['gluten', 'dairy'],
}

function mountCard(overrides: Partial<MenuItem> = {}) {
  return mount(MenuItemCard, { props: { item: { ...item, ...overrides } } })
}

describe('MenuItemCard', () => {
  it('shows the name, description and the price formatted from cents', () => {
    const wrapper = mountCard()

    expect(wrapper.get('h2').text()).toBe('Margherita pizza')
    expect(wrapper.text()).toContain('Tomato, fior di latte and basil.')
    expect(wrapper.get('.card__price').text()).toBe('€11.00')
  })

  it('lists allergens as labelled badges', () => {
    const wrapper = mountCard()

    expect(wrapper.get('ul').attributes('aria-label')).toBe('Allergens')
    expect(wrapper.findAll('li').map((badge) => badge.text())).toEqual(['gluten', 'dairy'])
  })

  it('has no allergen list when there are no allergens', () => {
    expect(mountCard({ allergens: [] }).find('ul').exists()).toBe(false)
  })

  it('loads the image lazily at a fixed size so it cannot shift the layout', () => {
    const image = mountCard().get('img')

    expect(image.attributes('loading')).toBe('lazy')
    expect(image.attributes('width')).toBe('400')
    expect(image.attributes('height')).toBe('300')
    expect(image.attributes('alt')).toBe('')
  })

  it('shows an initial instead of an image when there is none', () => {
    const wrapper = mountCard({ imageUrl: null })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.card__placeholder').text()).toBe('M')
    expect(wrapper.get('.card__placeholder').attributes('aria-hidden')).toBe('true')
  })

  it('marks an unavailable item as sold out', () => {
    const wrapper = mountCard({ available: false })

    expect(wrapper.text()).toContain('Sold out')
    expect(wrapper.classes()).toContain('card--unavailable')
  })

  it('does not say sold out for an available item', () => {
    expect(mountCard().text()).not.toContain('Sold out')
  })

  it('has an Add button named after the dish, which emits the dish', async () => {
    const wrapper = mountCard()

    await wrapper.get('[aria-label="Add Margherita pizza to cart"]').trigger('click')

    expect(wrapper.emitted('add')).toEqual([[item]])
  })

  it('says how many are already in the cart, only when some are', () => {
    expect(mountCard().text()).not.toContain('in cart')
    expect(mount(MenuItemCard, { props: { item, quantityInCart: 0 } }).text()).not.toContain(
      'in cart',
    )
    expect(mount(MenuItemCard, { props: { item, quantityInCart: 3 } }).text()).toContain(
      '3 in cart',
    )
  })

  it('cannot be added when sold out', () => {
    const wrapper = mountCard({ available: false })

    expect(wrapper.find('[aria-label^="Add "]').exists()).toBe(false)
  })
})
