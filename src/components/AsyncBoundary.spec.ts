import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import AsyncBoundary from '@/components/AsyncBoundary.vue'

const items = ['Margherita', 'Carbonara']

function renderItems({ data }: { data: string[] }) {
  return h(
    'ul',
    data.map((item) => h('li', item)),
  )
}

function mountBoundary(
  props: {
    data?: string[]
    error?: Error | null
    isLoading?: boolean
    isEmpty?: (data: string[]) => boolean
  },
  slots: Record<string, unknown> = {},
) {
  return mount(AsyncBoundary<string[]>, {
    props: { data: undefined, error: null, isLoading: false, ...props },
    slots: { default: renderItems, ...slots },
  })
}

describe('AsyncBoundary: loading', () => {
  it('shows a skeleton and announces loading while the first run is in flight', () => {
    const wrapper = mountBoundary({ isLoading: true })

    expect(wrapper.get('[role="status"]').text()).toBe('Loading')
    expect(wrapper.find('.skeleton').exists()).toBe(true)
    expect(wrapper.find('li').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })

  it('also shows the skeleton before the first run has started', () => {
    const wrapper = mountBoundary({})

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('hides the decorative skeleton from assistive technology', () => {
    const wrapper = mountBoundary({ isLoading: true })

    expect(wrapper.get('.loading').attributes('aria-hidden')).toBe('true')
  })

  it('lets the page supply its own skeleton', () => {
    const wrapper = mountBoundary(
      { isLoading: true },
      { loading: () => h('p', { class: 'custom' }, 'Cards…') },
    )

    expect(wrapper.find('.custom').exists()).toBe(true)
    expect(wrapper.find('.skeleton').exists()).toBe(false)
  })
})

describe('AsyncBoundary: error', () => {
  it('shows the message as an alert with a retry button', async () => {
    const wrapper = mountBoundary({ error: new Error('Network error. Check your connection.') })

    expect(wrapper.get('[role="alert"]').text()).toContain('Network error. Check your connection.')
    expect(wrapper.find('li').exists()).toBe(false)

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('wins over data that is still around from an earlier run', () => {
    const wrapper = mountBoundary({ data: items, error: new Error('Failed to refresh') })

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('li').exists()).toBe(false)
  })

  it('lets the page replace the error view and hands it the error and retry', async () => {
    const wrapper = mountBoundary(
      { error: new Error('boom') },
      {
        error: ({ error, retry }: { error: Error; retry: () => void }) =>
          h('button', { class: 'custom', onClick: retry }, `Custom: ${error.message}`),
      },
    )

    expect(wrapper.get('.custom').text()).toBe('Custom: boom')
    await wrapper.get('.custom').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})

describe('AsyncBoundary: empty', () => {
  it('shows an empty state for an empty list', () => {
    const wrapper = mountBoundary({ data: [] })

    expect(wrapper.text()).toContain('Nothing here yet')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('lets the page say what is missing and offer a way out', () => {
    const wrapper = mountBoundary(
      { data: [] },
      { empty: () => h('p', { class: 'custom' }, 'No dishes match "xyz"') },
    )

    expect(wrapper.get('.custom').text()).toBe('No dishes match "xyz"')
  })

  it('accepts a custom definition of empty', () => {
    const wrapper = mountBoundary({ data: items, isEmpty: (data) => data.length < 3 })

    expect(wrapper.text()).toContain('Nothing here yet')
  })
})

describe('AsyncBoundary: success', () => {
  it('renders the content with the data', () => {
    const wrapper = mountBoundary({ data: items })

    expect(wrapper.findAll('li').map((li) => li.text())).toEqual(items)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })

  it('keeps showing the data, marked busy, while a re-run loads', () => {
    const wrapper = mountBoundary({ data: items, isLoading: true })

    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.find('.skeleton').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })
})
