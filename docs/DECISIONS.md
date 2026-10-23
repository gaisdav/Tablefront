# Decisions and trade-offs

The choices that shape this codebase, and why. Each one was made for a reason that would be different in a bigger team or with a real backend; those cases are noted.

## State

- **Pinia for state that is shared and outlives a page** (cart, session, the orders this browser placed, toasts); **plain composables for everything else** (menu list, admin boards, forms). A list belongs to the page that shows it: it is fetched on entry, thrown away on exit, and putting it in a global store would add invalidation rules to solve a problem it does not have. The cart is the opposite: the header, every dish card, the drawer and checkout read and change it.
- **Persisted state is untrusted input.** Cart, remembered orders, session and the mock database are versioned, validated on load and never throw: a damaged cart is dropped (or repaired line by line), a damaged database is replaced whole, because a database with a few bad records would be wrong in ways nobody could see.

## Data fetching

- **A hand-written `useAsyncState` instead of a query library.** The need is small and well defined: loading, error, data, cancel on change and unmount, no stale answer overwriting a newer one. About a hundred lines, fully tested, and the race handling is visible instead of hidden in a dependency. A real app with caching, deduplication and background refetching across many screens should use TanStack Query.
- **`usePolling` is its own composable** (one request at a time, paused in hidden tabs, back-off on errors, stops for "fatal" errors such as a 401). Two pages use it with different rules, passed in rather than copied.
- **One HTTP client**, the only code that calls `fetch`: timeout, abort, typed errors with field errors, bearer token, and a central 401 that ends the session and returns to sign-in with the page remembered.

## Optimistic updates and races

- **Only changes that are cheap to undo and expected to succeed are optimistic**: an order's status on the board, a dish's availability. Creating, editing and deleting wait for the server, because their forms must stay open to show errors and a delete that appears to work when it did not is worse than a short wait.
- **The screen shows the server's data with the user's pending changes laid over it**, not a copy edited in place. A refresh that started before a change was saved can answer after it, carrying the old value; each change records which refresh it can be trusted against, and an answer that is discarded cannot remove a change. Changes to one item are queued one at a time so they reach the server in the order they were made.
- **Writes touch only what changed**: saving the availability switch writes back only `available`, so a refresh or edit that landed meanwhile is not overwritten with an older copy.

## The mock backend

- **MSW rather than a fake `fetch` or a JSON server.** The app makes real HTTP requests through the real client, so the same handlers serve the browser demo and the tests, and the API contract (status codes, field errors, `409` on a bad transition) is written once. Tests and demo cannot drift apart.
- **Failures are part of the mock**, not an afterthought: latency, error rate and offline are conditions every handler honours, and the Dev tools panel is just a UI over them. That is how a reviewer, and the end-to-end tests, reach the unhappy paths.
- **The demo database persists in `localStorage`** so tracking and "My orders" make sense across reloads; it is opt-in for the browser build only, so tests stay isolated and deterministic.

## Order lifecycle

- **The statuses an order can move to depend on how it is received.** A pickup goes `new → preparing → ready → completed`; a delivery goes `… → ready → out for delivery → completed`. One table in `src/domain/orderStatus.ts`, keyed by fulfillment, is the single source for the buttons, the mock API's `409`, the guest stepper and the validation of saved data; a pickup can never be "on the way", and nothing can be cancelled once the food is ready.

## UI

- **No UI kit and no CSS framework.** The surface is small enough (about a dozen base components) that owning them is cheaper than fighting a kit's defaults, and accessibility behaviour (focus trap and stack, Escape, scroll lock, live regions, a real table next to the card list on phones) is deliberate and tested rather than inherited. Scoped CSS over design tokens, mobile first, light and dark.
- **Presentational components do not know the API or the stores**: props in, events out. Pages orchestrate. That is what makes the base components cheap to test and to reuse.
- **Forms are hand-written**, three of them (checkout, login, dish). The rules live in plain functions in `src/domain`, shared by the form and its tests: inline errors, focus on the first problem, a message goes away as the field is fixed, one request however often it is submitted. A fourth or fifth form would justify a small helper, or a library.
- **Money is integer cents everywhere**; prices typed as text are parsed with integer arithmetic, and a price that is not whole cents throws instead of being displayed.

## Type safety

- **Strict TypeScript with `noUncheckedIndexedAccess`; no `any`, no `!`, and `as` only at a validated boundary with a written reason**, enforced by ESLint. Data entering from storage or the network passes a type guard first.

## What would change with a real backend

- The MSW layer and the Dev tools panel go away, `/api` points at the service, and the error shapes stay the same.
- **Real authentication**: short-lived tokens with refresh, `HttpOnly` cookies instead of `sessionStorage`, and server-side authorization (today the guard only decides what to show).
- **Server-driven updates** (SSE or WebSocket) for the orders board and tracking, replacing polling.
- **Server-side filtering, sorting and pagination** for the admin lists; a query library for caching across screens.
- **Validation of API responses** at the boundary (a small hand-written layer or a schema library, once the contract is generated).
- **Concurrency and conflicts**: a version or `ETag` on dishes and orders, so two admins editing the same item get a `409` instead of the last write winning.
