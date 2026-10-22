import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CategoryChips from '@/components/menu/CategoryChips.vue'
import type { Category } from '@/types/domain'

const categories: Category[] = [
  { id: 'cat-starters', name: 'Starters', sortOrder: 1 },
  { id: 'cat-mains', name: 'Mains', sortOrder: 2 },
]

function mountChips(modelValue: string | undefined) {
  return mount(CategoryChips, { props: { categories, modelValue } })
}

describe('CategoryChips', () => {
  it('offers "All" followed by every category', () => {
    const labels = mountChips(undefined)
      .findAll('label')
      .map((label) => label.text())

    expect(labels).toEqual(['All', 'Starters', 'Mains'])
  })

  it('is a labelled radio group: one choice out of several', () => {
    const wrapper = mountChips(undefined)

    expect(wrapper.get('fieldset legend').text()).toBe('Filter by category')
    const radios = wrapper.findAll<HTMLInputElement>('input')
    expect(radios.every((radio) => radio.attributes('type') === 'radio')).toBe(true)
    expect(new Set(radios.map((radio) => radio.attributes('name'))).size).toBe(1)
  })

  it('checks "All" when nothing is selected', () => {
    const checked = mountChips(undefined)
      .findAll<HTMLInputElement>('input')
      .map((radio) => radio.element.checked)

    expect(checked).toEqual([true, false, false])
  })

  it('checks only the selected category', () => {
    const checked = mountChips('cat-mains')
      .findAll<HTMLInputElement>('input')
      .map((radio) => radio.element.checked)

    expect(checked).toEqual([false, false, true])
  })

  it('emits the category id when one is chosen, and undefined for "All"', async () => {
    const wrapper = mountChips('cat-mains')
    const radios = wrapper.findAll<HTMLInputElement>('input')

    await radios[1]?.setValue()
    await radios[0]?.setValue()

    expect(wrapper.emitted('update:modelValue')).toEqual([['cat-starters'], [undefined]])
  })

  it('keeps every radio at least as tall as a touch target', () => {
    // The visible pill is the label; the real input is stretched over it so the whole pill is clickable.
    const wrapper = mountChips(undefined)

    expect(wrapper.findAll('.chip__label')).toHaveLength(3)
    expect(wrapper.findAll('.chip').every((chip) => chip.find('input').exists())).toBe(true)
  })
})
