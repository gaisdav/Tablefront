import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CartButton from '@/components/cart/CartButton.vue'

describe('CartButton', () => {
  it('says the cart is empty, with no badge', () => {
    const wrapper = mount(CartButton, { props: { count: 0 } })

    expect(wrapper.attributes('aria-label')).toBe('Cart, empty')
    expect(wrapper.find('.cart-button__count').exists()).toBe(false)
  })

  it('announces the number of items, singular and plural', () => {
    expect(mount(CartButton, { props: { count: 1 } }).attributes('aria-label')).toBe('Cart, 1 item')
    expect(mount(CartButton, { props: { count: 3 } }).attributes('aria-label')).toBe(
      'Cart, 3 items',
    )
  })

  it('shows the count visually but hides it from assistive technology (the label already says it)', () => {
    const badge = mount(CartButton, { props: { count: 3 } }).get('.cart-button__count')

    expect(badge.text()).toBe('3')
    expect(badge.attributes('aria-hidden')).toBe('true')
  })

  it('says when the cart changed on its own', () => {
    const wrapper = mount(CartButton, { props: { count: 2, hasNotices: true } })

    expect(wrapper.attributes('aria-label')).toBe('Cart, 2 items, has changes')
    expect(wrapper.find('.cart-button__alert').exists()).toBe(true)
  })

  it('opens a dialog and emits click', async () => {
    const wrapper = mount(CartButton, { props: { count: 1 } })

    await wrapper.trigger('click')

    expect(wrapper.attributes('aria-haspopup')).toBe('dialog')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
