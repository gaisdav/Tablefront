import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import App from '@/App.vue'
import { createAppRouter } from '@/router'

async function mountAt(path: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('guest shell', () => {
  it('renders the page inside the guest layout with a skip link and landmarks', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.get('main#main h1').text()).toBe('Menu')
    expect(wrapper.get('a.skip-link').attributes('href')).toBe('#main')
    expect(wrapper.get('nav[aria-label="Main"]').text()).toBe('Menu')
    expect(wrapper.find('footer').text()).toContain('Staff login')
  })

  it('marks the current page in the navigation', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.get('nav[aria-label="Main"] a').attributes('aria-current')).toBe('page')
  })

  it('renders the not-found page for unknown addresses, still in the guest layout', async () => {
    const wrapper = await mountAt('/no/such/page')

    expect(wrapper.get('main h1').text()).toBe('Page not found')
    expect(wrapper.find('footer').exists()).toBe(true)
  })
})

describe('admin shell', () => {
  it('renders admin pages with the admin navigation, not the guest one', async () => {
    const wrapper = await mountAt('/admin/orders')

    const links = wrapper.findAll('nav[aria-label="Admin"] a')
    expect(links.map((link) => link.text())).toEqual(['Orders', 'Menu'])
    expect(links[0]?.attributes('aria-current')).toBe('page')
    expect(links[1]?.attributes('aria-current')).toBeUndefined()
    expect(wrapper.find('nav[aria-label="Main"]').exists()).toBe(false)
  })

  it('renders the login page without any layout', async () => {
    const wrapper = await mountAt('/admin/login')

    expect(wrapper.get('h1').text()).toBe('Staff sign in')
    expect(wrapper.find('nav').exists()).toBe(false)
  })
})
