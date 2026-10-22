import { createMemoryHistory, START_LOCATION } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createAppRouter } from '@/router'
import { scrollBehavior } from '@/router/scroll'

async function scrollFor(path: string, savedPosition: { left: number; top: number } | null = null) {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/')
  const from = router.currentRoute.value
  await router.push(path)
  return scrollBehavior(router.currentRoute.value, from, savedPosition)
}

describe('scrollBehavior', () => {
  it('scrolls to the top on a normal navigation', async () => {
    expect(await scrollFor('/checkout')).toEqual({ top: 0 })
  })

  it('stays put when only the query changes: a filter or a selected row keeps the user in place', async () => {
    expect(await scrollFor('/?category=cat-mains')).toBe(false)
  })

  it('starts at the top on the very first navigation, even to the same path', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')

    expect(scrollBehavior(router.currentRoute.value, START_LOCATION, null)).toEqual({ top: 0 })
  })

  it('restores the saved position on back and forward', async () => {
    expect(await scrollFor('/checkout', { left: 0, top: 480 })).toEqual({ left: 0, top: 480 })
  })

  it('scrolls to the target of an in-page link, such as the skip link', async () => {
    expect(await scrollFor('/#main')).toEqual({ el: '#main' })
  })
})
