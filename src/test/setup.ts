import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { bindSession } from '@/api/client'
import { resetMockConditions, setMockConditions } from '@/mocks/conditions'
import { resetDb } from '@/mocks/db'
import { server } from '@/mocks/server'
import { fakeMediaQuery } from '@/test/media'

beforeAll(() => {
  // jsdom does not implement scrolling; the router's scroll behaviour calls it on every navigation.
  vi.stubGlobal('scrollTo', vi.fn())
  // ...nor media queries: every query is "no match" (a phone) unless a test installs its own.
  vi.stubGlobal('matchMedia', (query: string) => fakeMediaQuery(query, false))
  // Fail loudly if code under test calls an endpoint nobody mocked.
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetDb()
  resetMockConditions()
  // Tests are deterministic: no simulated latency unless a test asks for it.
  setMockConditions({ latency: 'none' })
})

afterEach(() => {
  server.resetHandlers()
  bindSession({ getToken: () => null, onUnauthorized: () => undefined })
})

afterAll(() => {
  server.close()
})
