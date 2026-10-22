import { bindSession } from '@/api/client'
import { authApi } from '@/api/authApi'
import { MOCK_ADMIN } from '@/mocks/fixtures'

/** Runs the promise and returns the rejection, failing the test if it resolves. */
export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
}

/** Logs in against the mock API and makes the shared client send the token. */
export async function signInAsAdmin(): Promise<void> {
  const { token } = await authApi.login(MOCK_ADMIN)
  bindSession({ getToken: () => token, onUnauthorized: () => undefined })
}

/** Back to an anonymous guest. */
export function signOut(): void {
  bindSession({ getToken: () => null, onUnauthorized: () => undefined })
}

/** An already signed-in staff session, the way a reload of the tab would find it. */
export function startStaffSession(): void {
  sessionStorage.setItem('tablefront:admin-token', 'mock-admin-token')
}
