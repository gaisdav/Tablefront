import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '@/App.vue'

describe('App', () => {
  it('renders the default title', () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('Tablefront')
  })

  it('renders a custom title passed as a prop', () => {
    const wrapper = mount(App, { props: { title: 'Menu' } })

    expect(wrapper.get('h1').text()).toBe('Menu')
  })
})
