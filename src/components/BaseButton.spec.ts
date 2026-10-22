import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseButton from '@/components/BaseButton.vue'

describe('BaseButton', () => {
  it('renders its label and defaults to type="button" so it never submits a form by accident', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Add to cart' } })

    expect(wrapper.text()).toBe('Add to cart')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('can be a submit button', () => {
    const wrapper = mount(BaseButton, { props: { type: 'submit' } })

    expect(wrapper.attributes('type')).toBe('submit')
  })

  it('emits clicks', async () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Go' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('does not fire clicks when disabled', async () => {
    const wrapper = mount(BaseButton, { props: { disabled: true }, slots: { default: 'Go' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('is busy and not clickable while loading, but keeps its label', async () => {
    const wrapper = mount(BaseButton, {
      props: { loading: true },
      slots: { default: 'Place order' },
    })

    await wrapper.trigger('click')

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toBe('Place order')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('is not marked busy when idle', () => {
    const wrapper = mount(BaseButton)

    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })
})
