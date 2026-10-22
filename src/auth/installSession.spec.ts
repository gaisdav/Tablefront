import { flushPromises } from '@vue/test-utils'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminApi } from '@/api/adminApi'
import { safeRedirect } from '@/auth/installSession'
import { server } from '@/mocks/server'
import { startStaffSession } from '@/test/helpers'
import { mountAppAt, unmountApps } from '@/test/mountApp'

afterEach(unmountApps)

describe('safeRedirect', () => {
  it.each(['/admin/menu', '/admin/orders?status=new', '/orders/ord-1'])(
    'follows the in-site address %s',
    (target) => {
      expect(safeRedirect(target)).toBe(target)
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
  ])('does not follow %j', (target) => {
    expect(safeRedirect(target)).toEqual({ name: 'admin-orders' })
  })

  it('uses the first of repeated parameters, and falls back when there is none', () => {
    expect(safeRedirect(['/admin/menu', '//evil.example'])).toBe('/admin/menu')
    expect(safeRedirect(undefined)).toEqual({ name: 'admin-orders' })
    expect(safeRedirect(null)).toEqual({ name: 'admin-orders' })
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
