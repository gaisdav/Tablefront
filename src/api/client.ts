import { createHttpClient } from '@/api/http'

export interface SessionHandlers {
  getToken: () => string | null
  onUnauthorized: () => void
}

// The auth store does not exist yet. Until it calls `bindSession`, requests are anonymous.
let session: SessionHandlers = {
  getToken: () => null,
  onUnauthorized: () => undefined,
}

/** Connects the shared client to the auth session: token injection and central 401 handling. */
export function bindSession(handlers: SessionHandlers): void {
  session = handlers
}

/** The app-wide client. Swapping the backend means changing `baseUrl` here. */
export const http = createHttpClient({
  baseUrl: '/api',
  getToken: () => session.getToken(),
  onUnauthorized: () => {
    session.onUnauthorized()
  },
})
