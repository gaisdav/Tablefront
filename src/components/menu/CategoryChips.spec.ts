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
      .findAll('button')
      .map((button) => button.text())

    expect(labels).toEqual(['All', 'Starters', 'Mains'])
  })

  it('is a labelled group of toggle buttons', () => {
    const wrapper = mountChips(undefined)

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Filter by category')
    expect(
      wrapper.findAll('button').every((button) => button.attributes('type') === 'button'),
    ).toBe(true)
  })

  it('marks "All" as pressed when nothing is selected', () => {
    const pressed = mountChips(undefined)
      .findAll('button')
      .map((button) => button.attributes('aria-pressed'))

    expect(pressed).toEqual(['true', 'false', 'false'])
  })

  it('marks only the selected category as pressed', () => {
    const pressed = mountChips('cat-mains')
      .findAll('button')
      .map((button) => button.attributes('aria-pressed'))

    expect(pressed).toEqual(['false', 'false', 'true'])
  })

  it('emits the category id when one is chosen, and undefined for "All"', async () => {
    const wrapper = mountChips('cat-mains')

    await wrapper.findAll('button')[1]?.trigger('click')
    await wrapper.findAll('button')[0]?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['cat-starters'], [undefined]])
  })
})
