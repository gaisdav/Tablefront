import { type VueWrapper } from '@vue/test-utils'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOCK_ADMIN } from '@/mocks/fixtures'
import { server } from '@/mocks/server'
import { mountAppAt, unmountApps } from '@/test/mountApp'

const field = (wrapper: VueWrapper, name: string) =>
  wrapper.get<HTMLInputElement>(`input[name="${name}"]`)
const submit = (wrapper: VueWrapper) => wrapper.get('form').trigger('submit')
const errors = (wrapper: VueWrapper) => wrapper.findAll('.field__error').map((e) => e.text())

async function fill(wrapper: VueWrapper, email = MOCK_ADMIN.email, password = MOCK_ADMIN.password) {
  await field(wrapper, 'email').setValue(email)
  await field(wrapper, 'password').setValue(password)
}

afterEach(unmountApps)

describe('the staff sign-in page', () => {
  it('is a plain page with a heading, labelled fields and the demo credentials', async () => {
    const { wrapper } = await mountAppAt('/admin/login')

    expect(wrapper.get('h1').text()).toBe('Staff sign in')
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.get('label[for]').text()).toBe('Email')
    expect(wrapper.text()).toContain(MOCK_ADMIN.email)
    expect(wrapper.text()).toContain(MOCK_ADMIN.password)
    expect(field(wrapper, 'password').attributes('type')).toBe('password')
    expect(field(wrapper, 'password').attributes('autocomplete')).toBe('current-password')
  })

  it('shows what is missing inline and focuses the first problem, without a request', async () => {
    let requests = 0
    server.use(
      mswHttp.post('/api/auth/login', () => {
        requests += 1
        return undefined
      }),
    )
    const { wrapper } = await mountAppAt('/admin/login')

    await submit(wrapper)

    expect(errors(wrapper)).toEqual(['Email is required', 'Password is required'])
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field(wrapper, 'email').element)
    })
    expect(requests).toBe(0)
  })

  it('clears a message as the field is fixed', async () => {
    const { wrapper } = await mountAppAt('/admin/login')
    await submit(wrapper)

    await field(wrapper, 'email').setValue('admin@tablefront.test')

    expect(errors(wrapper)).toEqual(['Password is required'])
  })

  it('signs in and goes to the orders', async () => {
    const { wrapper, router } = await mountAppAt('/admin/login')
    await fill(wrapper)

    await submit(wrapper)

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('admin-orders')
    })
    expect(sessionStorage.getItem('tablefront:admin-token')).not.toBeNull()
  })

  it('goes back to the page the user was sent away from', async () => {
    const { wrapper, router } = await mountAppAt('/admin/menu')
    expect(router.currentRoute.value.name).toBe('admin-login')
    await fill(wrapper)

    await submit(wrapper)

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('admin-menu')
    })
  })

  it('says the credentials are wrong and keeps what was typed, so one slip is easy to fix', async () => {
    const { wrapper, router } = await mountAppAt('/admin/login')
    await fill(wrapper, MOCK_ADMIN.email, 'wrong')

    await submit(wrapper)

    const alert = await vi.waitFor(() => wrapper.get('[role="alert"]'))
    expect(alert.text()).toContain('Wrong email or password')
    expect(field(wrapper, 'password').element.value).toBe('wrong')
    expect(errors(wrapper)).toEqual([])
    expect(field(wrapper, 'email').element.value).toBe(MOCK_ADMIN.email)
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(alert.element)
    })
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(sessionStorage.getItem('tablefront:admin-token')).toBeNull()
  })

  it('shows a generic message when the request fails for another reason', async () => {
    server.use(mswHttp.post('/api/auth/login', () => HttpResponse.error()))
    const { wrapper } = await mountAppAt('/admin/login')
    await fill(wrapper)

    await submit(wrapper)

    const alert = await vi.waitFor(() => wrapper.get('[role="alert"]'))
    expect(alert.text()).not.toBe('')
  })

  it('sends one request however often it is submitted while waiting', async () => {
    let requests = 0
    server.use(
      mswHttp.post('/api/auth/login', async () => {
        requests += 1
        await delay(60)
        return undefined
      }),
    )
    const { wrapper, router } = await mountAppAt('/admin/login')
    await fill(wrapper)

    void submit(wrapper)
    void submit(wrapper)
    await wrapper.get('button[type="submit"]').trigger('click')

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('admin-orders')
    })
    expect(requests).toBe(1)
  })
})
