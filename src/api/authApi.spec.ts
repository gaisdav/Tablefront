import { describe, expect, it } from 'vitest'
import { authApi } from '@/api/authApi'
import { MOCK_ADMIN } from '@/mocks/fixtures'
import { rejection } from '@/test/helpers'

describe('authApi.login', () => {
  it('returns a token for the mock admin', async () => {
    const { token } = await authApi.login(MOCK_ADMIN)

    expect(token).not.toBe('')
  })

  it.each([
    ['wrong password', { email: MOCK_ADMIN.email, password: 'nope' }],
    ['wrong email', { email: 'someone@else.test', password: MOCK_ADMIN.password }],
    ['empty credentials', { email: '', password: '' }],
  ])('rejects with 401 for %s', async (_label, credentials) => {
    const error = await rejection(authApi.login(credentials))

    expect(error).toMatchObject({ status: 401, code: 'invalid_credentials' })
  })
})
