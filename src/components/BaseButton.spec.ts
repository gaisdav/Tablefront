import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
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

  it('is busy and swallows clicks while loading, but keeps its label', async () => {
    const wrapper = mount(BaseButton, {
      props: { loading: true },
      slots: { default: 'Place order' },
    })

    await wrapper.trigger('click')

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.text()).toBe('Place order')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('keeps keyboard focus while loading instead of dropping it to the page', async () => {
    const wrapper = mount(BaseButton, {
      attachTo: document.body,
      slots: { default: 'Place order' },
    })
    wrapper.get('button').element.focus()

    await wrapper.setProps({ loading: true })

    expect(wrapper.attributes('disabled')).toBeUndefined()
    expect(document.activeElement).toBe(wrapper.element)
    wrapper.unmount()
  })

  it('does not submit its form while loading', async () => {
    const submitted: string[] = []
    const Form = defineComponent({
      props: { loading: Boolean },
      setup(props) {
        return () =>
          h(
            'form',
            {
              onSubmit: (event: Event) => {
                event.preventDefault()
                submitted.push('submit')
              },
            },
            h(BaseButton, { type: 'submit', loading: props.loading }, () => 'Place order'),
          )
      },
    })
    const wrapper = mount(Form, { props: { loading: false }, attachTo: document.body })

    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ loading: true })
    await wrapper.get('button').trigger('click')

    expect(submitted).toEqual(['submit'])
    wrapper.unmount()
  })

  it('is not marked busy when idle', () => {
    const wrapper = mount(BaseButton)

    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })
})
