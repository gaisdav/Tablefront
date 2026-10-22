import { setupServer } from 'msw/node'

// Handlers for the full API contract are registered in the next PR; tests add their own with `server.use`.
export const server = setupServer()
