import { setupWorker } from 'msw/browser'
import { enableDbPersistence } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'

export const worker = setupWorker(...handlers)

// In the browser the demo remembers its orders and menu edits across reloads, so "My orders" and the
// tracking page still work after a refresh. Tests import `db` directly and are not affected.
enableDbPersistence()
