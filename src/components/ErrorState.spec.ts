import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ErrorState from '@/components/ErrorState.vue'

describe('ErrorState', () => {
  it('announces the problem as an alert', () => {
    const wrapper = mount(ErrorState, { props: { message: 'Could not load the menu.' } })

    expect(wrapper.get('[role="alert"]').text()).toContain('Something went wrong')
    expect(wrapper.text()).toContain('Could not load the menu.')
  })

  it('accepts a custom title and retry label', () => {
    const wrapper = mount(ErrorState, {
      props: { title: 'Menu unavailable', message: 'x', retryLabel: 'Reload' },
    })

    expect(wrapper.text()).toContain('Menu unavailable')
    expect(wrapper.get('button').text()).toBe('Reload')
  })

  it('emits retry from its button', async () => {
    const wrapper = mount(ErrorState, { props: { message: 'x' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
