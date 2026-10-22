import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/api/errors'
import { MOCK_ADMIN, MOCK_ADMIN_TOKEN } from '@/mocks/fixtures'
import { useAuthStore } from '@/stores/auth'
import { rejection } from '@/test/helpers'

const KEY = 'tablefront:admin-token'

function store() {
  setActivePinia(createPinia())
  return useAuthStore()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the auth store', () => {
  it('starts signed out', () => {
    const auth = store()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
  })

  it('signs in with the right credentials and keeps the token for this tab', async () => {
    const auth = store()

    await auth.login(MOCK_ADMIN)
    await nextTick()

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe(MOCK_ADMIN_TOKEN)
    expect(sessionStorage.getItem(KEY)).toBe(MOCK_ADMIN_TOKEN)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('stays signed out, with the API error, when the credentials are wrong', async () => {
    const auth = store()

    const error = await rejection(auth.login({ email: MOCK_ADMIN.email, password: 'nope' }))

    expect(isApiError(error) && error.status).toBe(401)
    expect(auth.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('writes the token to storage at once, not a tick later', async () => {
    const auth = store()

    await auth.login(MOCK_ADMIN)
    expect(sessionStorage.getItem(KEY)).toBe(MOCK_ADMIN_TOKEN)

    auth.logout()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('signs out and forgets the token', async () => {
    const auth = store()
    await auth.login(MOCK_ADMIN)

    auth.logout()
    await nextTick()

    expect(auth.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('is still signed in after the page is reloaded', async () => {
    await store().login(MOCK_ADMIN)
    await nextTick()

    expect(store().isAuthenticated).toBe(true)
  })

  it('treats an empty saved token as signed out', () => {
    sessionStorage.setItem(KEY, '')

    expect(store().isAuthenticated).toBe(false)
  })

  it('is signed out when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(store().isAuthenticated).toBe(false)
  })

  it('stays signed in, in memory, when storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const auth = store()

    await auth.login(MOCK_ADMIN)
    await nextTick()

    expect(auth.isAuthenticated).toBe(true)
  })
})
