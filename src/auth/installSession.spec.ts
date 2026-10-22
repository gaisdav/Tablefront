import { flushPromises } from '@vue/test-utils'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { createMemoryHistory } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminApi } from '@/api/adminApi'
import { safeRedirect } from '@/auth/installSession'
import { createAppRouter } from '@/router'
import { server } from '@/mocks/server'
import { startStaffSession } from '@/test/helpers'
import { mountAppAt, unmountApps } from '@/test/mountApp'

afterEach(unmountApps)

const router = createAppRouter(createMemoryHistory())

describe('safeRedirect', () => {
  it.each(['/admin/menu', '/admin/orders?status=new', '/orders/ord-1'])(
    'follows the in-site address %s',
    (target) => {
      expect(safeRedirect(router, target)).toBe(target)
    },
  )

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'admin/menu',
    '',
    '/admin/login',
    '/admin/login?redirect=/x',
    '/\t/evil.example',
    ' /admin/menu',
    '/admin/login-history',
    '/no/such/page',
  ])('does not follow %j', (target) => {
    expect(safeRedirect(router, target)).toEqual({ name: 'admin-orders' })
  })

  it('keeps the query of an in-site address', () => {
    expect(safeRedirect(router, '/admin/orders?status=new&order=ord-1')).toBe(
      '/admin/orders?status=new&order=ord-1',
    )
  })

  it('uses the first of repeated parameters, and falls back when there is none', () => {
    expect(safeRedirect(router, ['/admin/menu', '//evil.example'])).toBe('/admin/menu')
    expect(safeRedirect(router, undefined)).toEqual({ name: 'admin-orders' })
    expect(safeRedirect(router, null)).toEqual({ name: 'admin-orders' })
  })
})

describe('the route guard', () => {
  it('sends a visitor without a session to the login page, remembering where they wanted to go', async () => {
    const { router } = await mountAppAt('/admin/menu')

    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(router.currentRoute.value.query.redirect).toBe('/admin/menu')
  })

  it('keeps the query of the page they wanted', async () => {
    const { router } = await mountAppAt('/admin/orders?status=new&order=ord-1')

    expect(router.currentRoute.value.query.redirect).toBe('/admin/orders?status=new&order=ord-1')
  })

  it('lets a signed-in member of staff in', async () => {
    startStaffSession()
    const { router } = await mountAppAt('/admin/menu')

    expect(router.currentRoute.value.name).toBe('admin-menu')
  })

  it('takes signed-in staff past the login page, to where they were going', async () => {
    startStaffSession()

    const plain = await mountAppAt('/admin/login')
    expect(plain.router.currentRoute.value.name).toBe('admin-orders')

    const withReturn = await mountAppAt('/admin/login?redirect=/admin/menu')
    expect(withReturn.router.currentRoute.value.name).toBe('admin-menu')
  })

  it('does not follow a return address that leaves the site', async () => {
    startStaffSession()
    const { router } = await mountAppAt('/admin/login?redirect=//evil.example')

    expect(router.currentRoute.value.name).toBe('admin-orders')
  })

  it('does not get in the way of the guest pages', async () => {
    const { router } = await mountAppAt('/checkout')

    expect(router.currentRoute.value.name).toBe('checkout')
  })
})

describe('a 401 in the middle of a session', () => {
  function expireSessions() {
    server.use(
      mswHttp.get('/api/admin/orders', () =>
        HttpResponse.json(
          { error: { code: 'unauthorized', message: 'Session expired' } },
          { status: 401 },
        ),
      ),
    )
  }

  it('ends the session and goes to the login page, remembering the page', async () => {
    startStaffSession()
    const { router } = await mountAppAt('/admin/menu')
    expireSessions()

    await adminApi.listOrders().catch(() => undefined)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(router.currentRoute.value.query.redirect).toBe('/admin/menu')
    expect(sessionStorage.getItem('tablefront:admin-token')).toBeNull()
  })

  it('remembers where the user was heading when a navigation is still under way', async () => {
    startStaffSession()
    const { router: appRouter } = await mountAppAt('/admin/menu')
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    // A page that is slow to open: the router still says the user is on the menu.
    appRouter.beforeEach(async (to) => {
      if (to.path === '/admin/orders') await held
    })
    server.use(
      mswHttp.get('/api/admin/orders', () =>
        HttpResponse.json({ error: { code: 'unauthorized', message: 'No' } }, { status: 401 }),
      ),
    )

    const navigation = appRouter.push('/admin/orders?status=new')
    await adminApi.listOrders().catch(() => undefined)
    release()
    await navigation
    await flushPromises()

    expect(appRouter.currentRoute.value.name).toBe('admin-login')
    expect(appRouter.currentRoute.value.query.redirect).toBe('/admin/orders?status=new')
  })

  it('keeps the first address when a slower request fails after the user was already sent away', async () => {
    startStaffSession()
    const { router } = await mountAppAt('/admin/menu')
    let calls = 0
    server.use(
      mswHttp.get('/api/admin/orders', async () => {
        calls += 1
        if (calls > 1) await delay(80)
        return HttpResponse.json(
          { error: { code: 'unauthorized', message: 'No' } },
          { status: 401 },
        )
      }),
    )

    const requests = Promise.allSettled([adminApi.listOrders(), adminApi.listOrders()])
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('admin-login')
    })
    await requests
    await flushPromises()

    expect(router.currentRoute.value.query.redirect).toBe('/admin/menu')
  })

  it('goes only once when several requests fail together, and keeps the first address', async () => {
    startStaffSession()
    const { router } = await mountAppAt('/admin/menu')
    expireSessions()

    await Promise.allSettled([adminApi.listOrders(), adminApi.listOrders(), adminApi.listOrders()])
    await flushPromises()

    expect(router.currentRoute.value.query.redirect).toBe('/admin/menu')
  })
})
