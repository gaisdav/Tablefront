import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChipGroup from '@/components/ChipGroup.vue'

const options = [
  { value: undefined, label: 'All' },
  { value: '', label: 'Blank' },
  { value: 'a', label: 'A' },
]

function checked(modelValue: string | undefined) {
  return mount(ChipGroup, { props: { legend: 'Filter', options, modelValue } })
    .findAll<HTMLInputElement>('input')
    .map((radio) => radio.element.checked)
}

describe('ChipGroup', () => {
  it('is a labelled radio group with one chip per option', () => {
    const wrapper = mount(ChipGroup, {
      props: { legend: 'Filter by status', options, modelValue: undefined },
    })

    expect(wrapper.get('legend').text()).toBe('Filter by status')
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual(['All', 'Blank', 'A'])
  })

  it('checks exactly the chip whose value is selected, even for an empty-string or undefined value', () => {
    expect(checked(undefined)).toEqual([true, false, false])
    expect(checked('')).toEqual([false, true, false])
    expect(checked('a')).toEqual([false, false, true])
  })

  it('emits the value of the chip that was chosen, including undefined for "All"', async () => {
    const wrapper = mount(ChipGroup, { props: { legend: 'Filter', options, modelValue: 'a' } })

    await wrapper.findAll('input')[0]?.setValue()
    await wrapper.findAll('input')[1]?.setValue()

    expect(wrapper.emitted('update:modelValue')).toEqual([[undefined], ['']])
  })
})
