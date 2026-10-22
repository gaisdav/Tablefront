import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { bindSession } from '@/api/client'
import { resetMockConditions, setMockConditions } from '@/mocks/conditions'
import { resetDb } from '@/mocks/db'
import { server } from '@/mocks/server'

beforeAll(() => {
  // jsdom does not implement scrolling; the router's scroll behaviour calls it on every navigation.
  vi.stubGlobal('scrollTo', vi.fn())
  // Fail loudly if code under test calls an endpoint nobody mocked.
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  localStorage.clear()
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
