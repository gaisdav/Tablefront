import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseInput from '@/components/BaseInput.vue'

function mountInput(props: Partial<InstanceType<typeof BaseInput>['$props']> = {}) {
  return mount(BaseInput, { props: { label: 'Name', modelValue: '', ...props } })
}

describe('BaseInput', () => {
  it('connects the label to the input', () => {
    const wrapper = mountInput({ label: 'Phone' })

    const input = wrapper.get('input')
    expect(wrapper.get('label').text()).toBe('Phone')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
  })

  it('updates v-model as the user types', async () => {
    const wrapper = mountInput()

    await wrapper.get('input').setValue('Eva')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Eva']])
  })

  it('shows the current value', () => {
    const wrapper = mountInput({ modelValue: 'Eva' })

    expect(wrapper.get('input').element.value).toBe('Eva')
  })

  it('passes native attributes to the input, not the wrapper', () => {
    const wrapper = mount(BaseInput, {
      props: { label: 'Email', modelValue: '' },
      attrs: { autocomplete: 'email', name: 'email', required: true },
    })

    const input = wrapper.get('input')
    expect(input.attributes('autocomplete')).toBe('email')
    expect(input.attributes('name')).toBe('email')
    expect(input.attributes('required')).toBeDefined()
    expect(wrapper.attributes('autocomplete')).toBeUndefined()
  })

  it('marks the field invalid and links the error message to it', () => {
    const wrapper = mountInput({ error: 'Name is required' })

    const input = wrapper.get('input')
    const error = wrapper.get('.field__error')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(error.text()).toBe('Name is required')
    expect(input.attributes('aria-describedby')).toBe(error.attributes('id'))
  })

  it('links both the hint and the error when both are shown', () => {
    const wrapper = mountInput({ hint: 'As on your ID', error: 'Name is required' })

    const described = wrapper.get('input').attributes('aria-describedby')?.split(' ')
    expect(described).toEqual([
      wrapper.get('.field__hint').attributes('id'),
      wrapper.get('.field__error').attributes('id'),
    ])
  })

  it('has no validity or description attributes when there is nothing to say', () => {
    const input = mountInput().get('input')

    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(input.attributes('aria-describedby')).toBeUndefined()
  })
})
