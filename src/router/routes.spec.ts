import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createAppRouter } from '@/router'

function makeRouter() {
  return createAppRouter(createMemoryHistory())
}

/** Admin routes inherit `requiresAuth` from their parent; the guard checks every matched record. */
function requiresAuth(path: string): boolean {
  return makeRouter()
    .resolve(path)
    .matched.some((record) => record.meta.requiresAuth === true)
}

describe('routes', () => {
  it.each([
    ['/', 'menu'],
    ['/checkout', 'checkout'],
    ['/orders/ord-1003', 'order'],
    ['/admin/login', 'admin-login'],
    ['/admin/orders', 'admin-orders'],
    ['/admin/menu', 'admin-menu'],
    ['/anything/else', 'not-found'],
  ])('resolves %s to %s', (path, name) => {
    expect(makeRouter().resolve(path).name).toBe(name)
  })

  it('passes the order id as a param', () => {
    expect(makeRouter().resolve('/orders/ord-1003').params).toEqual({ id: 'ord-1003' })
  })

  it('requires auth for the admin area, except the login page', () => {
    expect(requiresAuth('/admin/orders')).toBe(true)
    expect(requiresAuth('/admin/menu')).toBe(true)
    expect(requiresAuth('/admin/login')).toBe(false)
  })

  it('keeps every guest route public', () => {
    for (const path of ['/', '/checkout', '/orders/ord-1', '/nope']) {
      expect(requiresAuth(path)).toBe(false)
    }
  })

  it('redirects /admin to the orders board', async () => {
    const router = makeRouter()

    await router.push('/admin')

    expect(router.currentRoute.value.name).toBe('admin-orders')
  })
})
