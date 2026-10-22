import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setMockConditions } from '@/mocks/conditions'
import { menuItems } from '@/mocks/fixtures'
import { server } from '@/mocks/server'
import { mountAppAt, unmountApps } from '@/test/mountApp'
import type { MenuItem } from '@/types/domain'

const availableCount = menuItems.filter((item) => item.available).length

async function mountMenu(path = '/') {
  const { wrapper, router } = await mountAppAt(path)
  return { wrapper, router }
}

/** Waits for the menu cards to be on screen. */
async function untilLoaded(wrapper: VueWrapper): Promise<void> {
  await vi.waitFor(() => {
    expect(
      wrapper.find('.card').exists() ||
        wrapper.find('[role="alert"]').exists() ||
        wrapper.text().includes('No dishes'),
    ).toBe(true)
  })
}

const names = (wrapper: VueWrapper) => wrapper.findAll('.card__name').map((name) => name.text())
const searchBox = (wrapper: VueWrapper) => wrapper.get<HTMLInputElement>('input[type="search"]')
const chip = (wrapper: VueWrapper, label: string) => {
  const found = wrapper.findAll('.chip').find((candidate) => candidate.text() === label)
  if (found === undefined) throw new Error(`No "${label}" chip`)
  return {
    isChecked: () => found.get<HTMLInputElement>('input').element.checked,
    choose: () => found.get('input').setValue(),
  }
}

function dish(name: string): MenuItem {
  return {
    id: `x-${name}`,
    name,
    description: '',
    priceCents: 100,
    categoryId: 'cat-mains',
    imageUrl: null,
    available: true,
    allergens: [],
  }
}

afterEach(() => {
  unmountApps()
  vi.useRealTimers()
})

describe('MenuPage: loading and content', () => {
  it('shows a skeleton while loading, then the dishes and the categories', async () => {
    const { wrapper } = await mountMenu()

    expect(wrapper.get('.results').text()).toBe('Loading…')
    expect(wrapper.find('.card').exists()).toBe(false)

    await untilLoaded(wrapper)

    expect(wrapper.findAll('.card')).toHaveLength(availableCount)
    expect(wrapper.find('.skeleton').exists()).toBe(false)
    expect(wrapper.get('.results').text()).toBe(`${String(availableCount)} dishes`)
    expect(wrapper.findAll('.chip').map((button) => button.text())).toEqual([
      'All',
      'Starters',
      'Mains',
      'Desserts',
      'Drinks',
    ])
  })

  it('announces how many dishes are shown', async () => {
    const { wrapper } = await mountMenu('/?q=sparkling')

    await untilLoaded(wrapper)

    expect(wrapper.get('.results').text()).toBe('1 dish')
    expect(wrapper.get('.results').attributes('role')).toBe('status')
  })
})

describe('MenuPage: category filter', () => {
  it('filters by category, puts it in the URL, and marks the chip as pressed', async () => {
    const { wrapper, router } = await mountMenu()
    await untilLoaded(wrapper)

    await chip(wrapper, 'Desserts').choose()
    await vi.waitFor(() => {
      expect(names(wrapper)).toEqual(['Tiramisu', 'Schwarzwälder Kirschtorte', 'Apfelstrudel'])
    })

    expect(router.currentRoute.value.query).toEqual({ category: 'cat-desserts' })
    expect(chip(wrapper, 'Desserts').isChecked()).toBe(true)
    expect(chip(wrapper, 'All').isChecked()).toBe(false)
  })

  it('"All" removes the category from the URL', async () => {
    const { wrapper, router } = await mountMenu('/?category=cat-drinks')
    await untilLoaded(wrapper)

    await chip(wrapper, 'All').choose()
    await vi.waitFor(() => {
      expect(wrapper.findAll('.card')).toHaveLength(availableCount)
    })

    expect(router.currentRoute.value.query).toEqual({})
  })

  it('keeps the old dishes on screen, dimmed, while the new ones load', async () => {
    server.use(
      mswHttp.get('/api/menu-items', async ({ request }) => {
        if (new URL(request.url).searchParams.get('categoryId') !== 'cat-drinks') return undefined
        await delay(150)
        return HttpResponse.json([dish('Tea')])
      }),
    )
    const { wrapper } = await mountMenu()
    await untilLoaded(wrapper)

    await chip(wrapper, 'Drinks').choose()
    await vi.waitFor(() => {
      expect(wrapper.find('.is-refreshing').exists()).toBe(true)
    })

    expect(wrapper.findAll('.card')).toHaveLength(availableCount)

    await vi.waitFor(() => {
      expect(names(wrapper)).toEqual(['Tea'])
    })
    expect(wrapper.find('.is-refreshing').exists()).toBe(false)
  })
})

describe('MenuPage: URL is the source of truth', () => {
  it('applies the filters found in the URL on load', async () => {
    const { wrapper } = await mountMenu('/?category=cat-drinks&q=lem')

    await untilLoaded(wrapper)

    expect(names(wrapper)).toEqual(['Lemonade'])
    expect(searchBox(wrapper).element.value).toBe('lem')
    expect(chip(wrapper, 'Drinks').isChecked()).toBe(true)
  })

  it('follows the URL when it changes underneath, as back and forward do', async () => {
    const { wrapper, router } = await mountMenu('/?q=pizza')
    await untilLoaded(wrapper)

    await router.push('/?q=lemonade')

    await vi.waitFor(() => {
      expect(names(wrapper)).toEqual(['Lemonade'])
    })
    expect(searchBox(wrapper).element.value).toBe('lemonade')
  })
})

describe('MenuPage: debounced search', () => {
  /** Records the `q` of every menu request and lets the default handler answer. */
  function recordRequests(): (string | null)[] {
    const seen: (string | null)[] = []
    server.use(
      mswHttp.get('/api/menu-items', ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('q'))
        return undefined
      }),
    )
    return seen
  }

  it('sends one request after the user pauses, not one per keystroke', async () => {
    const requests = recordRequests()
    const { wrapper, router } = await mountMenu()
    await untilLoaded(wrapper)
    expect(requests).toEqual([null])

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    for (const text of ['p', 'pi', 'piz', 'pizz', 'pizza']) {
      await searchBox(wrapper).setValue(text)
      vi.advanceTimersByTime(100)
    }
    expect(requests).toEqual([null])
    expect(router.currentRoute.value.query).toEqual({})

    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(names(wrapper)).toEqual(['Margherita pizza', 'Diavola pizza'])
    })

    expect(requests).toEqual([null, 'pizza'])
    expect(router.currentRoute.value.query).toEqual({ q: 'pizza' })
  })

  it('does not add history entries while typing', async () => {
    const { wrapper, router } = await mountMenu()
    await untilLoaded(wrapper)
    await chip(wrapper, 'Mains').choose()
    await vi.waitFor(() => {
      expect(router.currentRoute.value.query.category).toBe('cat-mains')
    })

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await searchBox(wrapper).setValue('pizza')
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(router.currentRoute.value.query.q).toBe('pizza')
    })

    router.back()
    await flushPromises()

    // Back skipped over the search and returned to the page before the category was chosen.
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('does not overwrite what the user is typing when the URL catches up', async () => {
    const { wrapper } = await mountMenu()
    await untilLoaded(wrapper)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await searchBox(wrapper).setValue('piz')
    vi.advanceTimersByTime(300) // the URL write for "piz" starts here
    await searchBox(wrapper).setValue('pizz') // the user keeps typing while it lands
    vi.useRealTimers()
    await flushPromises()

    expect(searchBox(wrapper).element.value).toBe('pizz')
  })
})

describe('MenuPage: out-of-order responses', () => {
  it('shows the answer to the latest filter even if an older one arrives later', async () => {
    server.use(
      mswHttp.get('/api/menu-items', async ({ request }) => {
        const q = new URL(request.url).searchParams.get('q')
        if (q === 'pi') {
          await delay(200)
          return HttpResponse.json([dish('Answer to "pi" (stale)')])
        }
        if (q === 'pizza') return HttpResponse.json([dish('Answer to "pizza"')])
        return undefined
      }),
    )
    const { wrapper, router } = await mountMenu()
    await untilLoaded(wrapper)

    void router.push('/?q=pi') // slow
    await flushPromises()
    void router.push('/?q=pizza') // fast, and newer
    await vi.waitFor(() => {
      expect(names(wrapper)).toEqual(['Answer to "pizza"'])
    })

    await new Promise((resolve) => setTimeout(resolve, 300)) // let the slow one finish
    expect(names(wrapper)).toEqual(['Answer to "pizza"'])
  })
})

describe('MenuPage: empty results', () => {
  it('explains that nothing matches, and "Clear filters" brings everything back', async () => {
    const { wrapper, router } = await mountMenu('/?category=cat-drinks&q=zzz')
    await untilLoaded(wrapper)

    expect(wrapper.text()).toContain('No dishes match “zzz”')

    const clear = wrapper.findAll('button').find((button) => button.text() === 'Clear filters')
    await clear?.trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.findAll('.card')).toHaveLength(availableCount)
    })

    expect(router.currentRoute.value.query).toEqual({})
    expect(searchBox(wrapper).element.value).toBe('')
  })

  it('says so when a category has no dishes', async () => {
    const { wrapper } = await mountMenu('/?category=cat-nope')

    await untilLoaded(wrapper)

    expect(wrapper.text()).toContain('No dishes in this category')
  })
})

describe('MenuPage: text describes the result that is on screen', () => {
  /** Answers the next request for `q` only after `ms`, so the test can look at the page in between. */
  function slowFor(q: string, ms: number) {
    server.use(
      mswHttp.get('/api/menu-items', async ({ request }) => {
        if (new URL(request.url).searchParams.get('q') !== q) return undefined
        await delay(ms)
        return undefined
      }),
    )
  }

  it('keeps the old empty-state title, dimmed, until the new result arrives', async () => {
    slowFor('pizza', 150)
    const { wrapper, router } = await mountMenu('/?q=zzz')
    await untilLoaded(wrapper)
    expect(wrapper.text()).toContain('No dishes match “zzz”')

    await router.push('/?q=pizza')
    await vi.waitFor(() => {
      expect(wrapper.find('.is-refreshing').exists()).toBe(true)
    })

    // The URL already says "pizza", but what is shown is still the answer to "zzz".
    expect(wrapper.text()).toContain('No dishes match “zzz”')
    expect(wrapper.text()).not.toContain('No dishes match “pizza”')

    await vi.waitFor(() => {
      expect(names(wrapper)).toEqual(['Margherita pizza', 'Diavola pizza'])
    })
    expect(wrapper.find('.is-refreshing').exists()).toBe(false)
  })

  it('says it is loading, instead of repeating the old count, while a new result is on its way', async () => {
    slowFor('pizza', 150)
    const { wrapper, router } = await mountMenu()
    await untilLoaded(wrapper)
    expect(wrapper.get('.results').text()).toBe(`${String(availableCount)} dishes`)

    await router.push('/?q=pizza')
    await vi.waitFor(() => {
      expect(wrapper.get('.results').text()).toBe('Loading…')
    })

    await vi.waitFor(() => {
      expect(wrapper.get('.results').text()).toBe('2 dishes')
    })
  })

  it('has a single live announcement for the list: the status line, not the skeleton region', async () => {
    const { wrapper } = await mountMenu()

    const announcements = wrapper
      .findAll('[role="status"]')
      .filter((region) => region.text() !== '')

    expect(announcements.map((region) => region.text())).toEqual(['Loading…'])
    await untilLoaded(wrapper)
  })

  it('goes quiet when a refresh fails, so a stale count is not read out next to the error', async () => {
    const { wrapper } = await mountMenu()
    await untilLoaded(wrapper)
    expect(wrapper.get('.results').text()).not.toBe('')

    setMockConditions({ errorRate: 'always' })
    await chip(wrapper, 'Drinks').choose()
    await vi.waitFor(() => {
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })

    expect(wrapper.get('.results').text()).toBe('')
  })

  it('Clear filters wins over text that was still being typed', async () => {
    const { wrapper, router } = await mountMenu('/?category=cat-drinks&q=zzz')
    await untilLoaded(wrapper)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await searchBox(wrapper).setValue('abc') // still inside the debounce window
    const clear = wrapper.findAll('button').find((button) => button.text() === 'Clear filters')
    await clear?.trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    vi.useRealTimers()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(searchBox(wrapper).element.value).toBe('')
  })
})

describe('MenuPage: errors', () => {
  it('shows the failure with a retry button, and recovers when retried', async () => {
    setMockConditions({ errorRate: 'always' })
    const { wrapper } = await mountMenu()

    await vi.waitFor(() => {
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('Simulated server error')
    expect(wrapper.find('.card').exists()).toBe(false)

    setMockConditions({ errorRate: 'off' })
    await wrapper.get('[role="alert"] button').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.findAll('.card')).toHaveLength(availableCount)
    })

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('lets the dishes load even if the categories could not', async () => {
    server.use(
      mswHttp.get('/api/categories', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    const { wrapper } = await mountMenu()

    await untilLoaded(wrapper)

    expect(wrapper.findAll('.card')).toHaveLength(availableCount)
    expect(wrapper.text()).toContain('Categories could not be loaded')
  })

  it('reports a lost connection instead of showing an empty menu', async () => {
    setMockConditions({ offline: true })
    const { wrapper } = await mountMenu()

    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text()).toContain('Network error')
    })
  })
})
