import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseCheckbox from '@/components/BaseCheckbox.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseSelect from '@/components/BaseSelect.vue'

describe('BaseInput: multiline', () => {
  it('is a labelled text area that follows its model', async () => {
    const wrapper = mount(BaseInput, {
      props: { modelValue: 'a', label: 'Description', multiline: true },
    })

    const area = wrapper.get('textarea')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('label').attributes('for')).toBe(area.attributes('id'))

    await area.setValue('b')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  it('carries the error to the text area like to an input', () => {
    const wrapper = mount(BaseInput, {
      props: { modelValue: '', label: 'Description', multiline: true, error: 'Too long' },
    })

    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('textarea').attributes('aria-describedby')).toBe(
      wrapper.get('.field__error').attributes('id'),
    )
  })
})

describe('BaseSelect', () => {
  const options = [
    { value: 'a', label: 'Starters' },
    { value: 'b', label: 'Mains' },
  ]

  it('is a labelled select showing the chosen option', () => {
    const wrapper = mount(BaseSelect, { props: { modelValue: 'b', label: 'Category', options } })

    expect(wrapper.get('label').text()).toBe('Category')
    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe('b')
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual(['Starters', 'Mains'])
  })

  it('emits the chosen value', async () => {
    const wrapper = mount(BaseSelect, { props: { modelValue: 'a', label: 'Category', options } })

    await wrapper.get('select').setValue('b')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  it('marks itself invalid and ties the message to the select', () => {
    const wrapper = mount(BaseSelect, {
      props: { modelValue: '', label: 'Category', options, error: 'Choose a category' },
    })

    expect(wrapper.get('select').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('select').attributes('aria-describedby')).toBe(
      wrapper.get('.field__error').attributes('id'),
    )
  })

  it('gives name and other attributes to the select, and class to the wrapper', () => {
    const wrapper = mount(BaseSelect, {
      props: { modelValue: 'a', label: 'Category', options },
      attrs: { name: 'categoryId', class: 'wide' },
    })

    expect(wrapper.get('select').attributes('name')).toBe('categoryId')
    expect(wrapper.get('.field').classes()).toContain('wide')
  })
})

describe('BaseCheckbox', () => {
  it('is a checkbox named by its label, and a click on the label toggles it', async () => {
    const wrapper = mount(BaseCheckbox, { props: { modelValue: false, label: 'Available' } })

    expect(wrapper.get('label').text()).toBe('Available')
    await wrapper.get('input').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('shows the checked state', () => {
    const wrapper = mount(BaseCheckbox, { props: { modelValue: true, label: 'Available' } })

    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(true)
  })
})
