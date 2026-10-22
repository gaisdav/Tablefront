import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { h, ref, type Component } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

const broken = ref(true)

const Fragile: Component = {
  setup() {
    return () => {
      if (broken.value) throw new Error('boom')
      return h('p', 'All good')
    }
  },
}

const Clicky: Component = {
  setup() {
    return () =>
      h(
        'button',
        {
          onClick: () => {
            throw new Error('handler boom')
          },
        },
        'Press',
      )
  },
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'menu', component: Fragile },
      { path: '/other', name: 'other', component: { render: () => h('p', 'Elsewhere') } },
      { path: '/clicky', name: 'clicky', component: Clicky },
    ],
  })
}

async function mountAt(path: string) {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(ErrorBoundary, null, { default: () => h(RouterView) }) },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  return { wrapper, router }
}

let report: MockInstance<typeof console.error>

beforeEach(() => {
  broken.value = true
  // The boundary reports what it caught; keep the test output clean and check that it did.
  report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  report.mockRestore()
})

describe('ErrorBoundary', () => {
  it('renders its content when nothing is wrong', async () => {
    broken.value = false
    const { wrapper } = await mountAt('/')

    expect(wrapper.text()).toBe('All good')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('replaces a page that fails to render with a friendly fallback, and reports the error', async () => {
    const { wrapper } = await mountAt('/')

    const alert = wrapper.get('[role="alert"]')
    expect(alert.get('h1').text()).toBe('Something went wrong')
    expect(alert.text()).not.toContain('boom')
    expect(report).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: 'boom' }),
    )
    wrapper.unmount()
  })

  it('catches an error thrown by an event handler too', async () => {
    const { wrapper } = await mountAt('/clicky')

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('[role="alert"]').text()).toContain('Something went wrong')
    wrapper.unmount()
  })

  it('"Try again" renders the page again, which works once the cause is gone', async () => {
    const { wrapper } = await mountAt('/')
    broken.value = false

    await wrapper.get('[role="alert"] button').trigger('click')

    expect(wrapper.text()).toBe('All good')
    wrapper.unmount()
  })

  it('shows the fallback again if the page still fails after "Try again"', async () => {
    const { wrapper } = await mountAt('/')

    await wrapper.get('[role="alert"] button').trigger('click')

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('"Back to the menu" leaves the broken page', async () => {
    const { wrapper, router } = await mountAt('/clicky')
    await wrapper.get('button').trigger('click')
    broken.value = false

    const buttons = wrapper.findAll('[role="alert"] button')
    await buttons[1]?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('menu')
    expect(wrapper.text()).toBe('All good')
    wrapper.unmount()
  })

  it('recovers by itself when the user navigates somewhere else', async () => {
    const { wrapper, router } = await mountAt('/')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await router.push('/other')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('Elsewhere')
    wrapper.unmount()
  })
})
