import { flushPromises, mount } from '@vue/test-utils'
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

  it('shows Add while none are in the cart, and the stepper once some are', () => {
    const none = mountCard()
    const some = mount(MenuItemCard, { props: { item, quantityInCart: 3 } })

    expect(none.find('[role="group"]').exists()).toBe(false)
    expect(none.find('[aria-label="Add Margherita pizza to cart"]').exists()).toBe(true)
    expect(some.find('[aria-label^="Add "]').exists()).toBe(false)
    expect(some.get('output').text()).toBe('3')
  })

  it('changes the quantity with + and −, and removes at one', async () => {
    const wrapper = mount(MenuItemCard, { props: { item, quantityInCart: 2 } })

    await wrapper.get('[aria-label="Increase quantity"]').trigger('click')
    await wrapper.get('[aria-label="Decrease quantity"]').trigger('click')
    await wrapper.setProps({ quantityInCart: 1 })
    await wrapper.get('[aria-label="Remove Margherita pizza from cart"]').trigger('click')

    expect(wrapper.emitted('change-quantity')).toEqual([
      [item, 3],
      [item, 1],
      [item, 0],
    ])
  })

  it('does not speak by itself: the cart announcement already says what changed', () => {
    const wrapper = mount(MenuItemCard, { props: { item, quantityInCart: 2 } })

    expect(wrapper.get('output').attributes('aria-live')).toBeUndefined()
  })

  describe('focus', () => {
    const stepperButton = (wrapper: ReturnType<typeof mountCard>) =>
      wrapper.get<HTMLElement>('[aria-label="Increase quantity"]').element
    const addButton = (wrapper: ReturnType<typeof mountCard>) =>
      wrapper.get<HTMLElement>('[data-add]').element

    function mountAttached(quantityInCart: number) {
      return mount(MenuItemCard, { props: { item, quantityInCart }, attachTo: document.body })
    }

    it('moves to + after Add turns into the stepper', async () => {
      const wrapper = mountAttached(0)

      // The store changes in the same tick as the click, as it does in the app.
      void wrapper.get('[data-add]').trigger('click')
      await wrapper.setProps({ quantityInCart: 1 })
      await flushPromises()

      expect(document.activeElement).toBe(stepperButton(wrapper))
      wrapper.unmount()
    })

    it('moves back to Add after the last one is removed', async () => {
      const wrapper = mountAttached(1)

      void wrapper.get('[aria-label="Remove Margherita pizza from cart"]').trigger('click')
      await wrapper.setProps({ quantityInCart: 0 })
      await flushPromises()

      expect(document.activeElement).toBe(addButton(wrapper))
      wrapper.unmount()
    })

    it('forgets an Add that changed nothing instead of stealing focus later', async () => {
      const wrapper = mountAttached(0)
      await wrapper.get('[data-add]').trigger('click') // the parent ignored it
      const other = document.createElement('input')
      document.body.append(other)
      other.focus()

      await wrapper.setProps({ quantityInCart: 0 })
      await wrapper.setProps({ quantityInCart: 2 }) // later, from the drawer
      await flushPromises()

      expect(document.activeElement).toBe(other)
      other.remove()
      wrapper.unmount()
    })

    it('does not take focus when the cart changed somewhere else', async () => {
      const wrapper = mountAttached(0)
      const other = document.createElement('input')
      document.body.append(other)
      other.focus()

      await wrapper.setProps({ quantityInCart: 2 })
      await wrapper.setProps({ quantityInCart: 0 })
      await flushPromises()

      expect(document.activeElement).toBe(other)
      other.remove()
      wrapper.unmount()
    })
  })

  it('cannot be added when sold out', () => {
    const wrapper = mountCard({ available: false })

    expect(wrapper.find('[aria-label^="Add "]').exists()).toBe(false)
  })
})
