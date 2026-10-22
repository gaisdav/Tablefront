import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import App from '@/App.vue'
import { createAppRouter } from '@/router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountAppAt, unmountApps } from '@/test/mountApp'

afterEach(unmountApps)

describe('route accessibility', () => {
  it('names the page in the tab title', async () => {
    const { router } = await mountAppAt('/')
    expect(document.title).toBe('Menu · Tablefront')

    await router.push('/orders')
    expect(document.title).toBe('My orders · Tablefront')

    await router.push('/no/such/page')
    expect(document.title).toBe('Page not found · Tablefront')
  })

  it('leaves focus alone on the very first page', async () => {
    await mountAppAt('/')
    await flushPromises()

    expect(document.activeElement).toBe(document.body)
  })

  it('leaves focus alone on the first page when the app is already on screen', async () => {
    const router = createAppRouter(createMemoryHistory())
    const wrapper = mount(App, {
      global: { plugins: [router, createPinia()] },
      attachTo: document.body,
    })

    await router.push('/checkout')
    await flushPromises()

    expect(document.activeElement).toBe(document.body)
    wrapper.unmount()
  })

  it('moves focus without scrolling, so the router decides where the page is', async () => {
    const { router } = await mountAppAt('/')
    await flushPromises()
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')

    await router.push('/checkout')
    await flushPromises()

    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    focus.mockRestore()
  })

  it('moves focus to the new page heading when the page changes', async () => {
    const { wrapper, router } = await mountAppAt('/')
    await flushPromises()
    wrapper.get<HTMLElement>('a.skip-link').element.focus()

    await router.push('/checkout')
    await flushPromises()

    expect(document.activeElement?.tagName).toBe('H1')
    expect(document.activeElement?.textContent).toBe('Checkout')
  })

  it('does not take focus away when only the query changes', async () => {
    const { wrapper, router } = await mountAppAt('/')
    await flushPromises()
    const search = wrapper.get<HTMLInputElement>('input[type="search"]')
    search.element.focus()

    await router.replace({ path: '/', query: { category: 'mains' } })
    await flushPromises()

    expect(document.activeElement).toBe(search.element)
  })

  it('keeps the heading out of the Tab order', async () => {
    const { router } = await mountAppAt('/')
    await router.push('/checkout')
    await flushPromises()

    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')
  })

  it('does the same in the admin area', async () => {
    sessionStorage.setItem('tablefront:admin-token', 'mock-admin-token')
    const { router } = await mountAppAt('/')

    await router.push('/admin/orders')
    await flushPromises()

    expect(document.activeElement?.tagName).toBe('H1')
  })
})
