import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EmptyState from '@/components/EmptyState.vue'

describe('EmptyState', () => {
  it('shows a title and an optional description', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No orders yet', description: 'New orders appear here.' },
    })

    expect(wrapper.text()).toContain('No orders yet')
    expect(wrapper.text()).toContain('New orders appear here.')
  })

  it('renders only what it is given', () => {
    const wrapper = mount(EmptyState, { props: { title: 'No orders yet' } })

    expect(wrapper.find('.state__description').exists()).toBe(false)
    expect(wrapper.find('.state__action').exists()).toBe(false)
  })

  it('renders an action when one is provided', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No dishes match' },
      slots: { action: '<button>Clear search</button>' },
    })

    expect(wrapper.get('.state__action button').text()).toBe('Clear search')
  })
})
