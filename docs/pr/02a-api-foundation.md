# PR 02a — Domain, API client, MSW test setup

First half of PR 02 (split agreed because the full scope is well over the size guideline).
02b adds the mock backend: fixtures, in-memory store, handlers for every endpoint, latency and failure-injection hooks, and tests for the resource modules.

## What changed

- **Domain types** (`src/types/domain.ts`) from the spec, plus request/response types (`src/types/api.ts`) and the shared error shape.
- **Order status transitions** (`src/domain/orderStatus.ts`): one table, `allowedTransitions` and `canTransition`, unit tested over every pair.
- **Money** (`src/domain/money.ts`): `formatCents` with `Intl.NumberFormat`, throws on non-integer input.
- **`http` client** (`src/api/http.ts`): typed `fetch` wrapper with JSON handling, query params, `AbortSignal`, timeout, bearer token injection and central 401 handling.
- **`ApiError`** (`src/api/errors.ts`): `status`, `code`, `message`, `fieldErrors`; plus `isApiError` and `isAbortError`.
- **Resource modules**: `menuApi`, `ordersApi`, `authApi`, `adminApi` with explicit request and response types.
- **MSW node server** wired into Vitest (`src/mocks/server.ts`, `src/test/setup.ts`); unmocked requests fail the test.
- **Lint rules**: `fetch`, `window.fetch` and `globalThis.fetch` are forbidden outside `src/api`; `<T>value` assertions are banned too.
- **Client tests** (`http.spec.ts`) run against MSW: success, query and body serialization, URL joining, empty 2xx bodies, 401 (with a token, without one, and with a token replaced mid-flight), 404, 409, 422 field errors, non-JSON error bodies, unreadable success bodies, network failure, timeout (including mid-body), caller abort.

## Why (decisions and trade-offs)

- **MSW 3, not 2.** The spec names MSW 2; 3.0.3 is the current release, so we use it. The visible difference so far: `server.listen({ onUnhandledFrame: 'error' })` replaces `onUnhandledRequest`.
- **Swapping the backend is one line.** Resource modules only know `http`; `http` is created in `src/api/client.ts` with `baseUrl: '/api'`.
- **The client does not know about the auth store.** It takes `getToken` and `onUnauthorized` callbacks; `bindSession` connects them once the auth store exists (PR 07). Until then requests are anonymous.
- **A 401 only counts as "session expired" if the token that was sent is still the current one.** With no token, a wrong password on the login form (also 401) would trigger a logout redirect; with a replaced token, a late response from a finished session would log out the new one.
- **Three kinds of failure, kept apart.** An HTTP error response becomes an `ApiError` with the server's code. No response at all (network, timeout) becomes an `ApiError` with `status: 0` and code `network_error` or `timeout`. The body is read inside the same `try` as the request, so a timeout that fires mid-body is still a `timeout`. A caller abort is recognised by comparing the thrown error with the caller signal's `reason` (a timeout or network failure that happens near the same moment is not mistaken for it) and rethrown untouched, so `useAsyncState` (PR 03) can ignore cancelled requests instead of showing them as errors. `isAbortError` matches by name because the DOMException can come from another realm (jsdom vs Node).
- **Timeouts use `AbortSignal.timeout` and `AbortSignal.any`**, so the caller's signal and the timeout combine without hand-rolled timers to clean up. Both are available in current browsers and in Node 22.
- **One cast, in one place.** `asResponse<T>` is the only place a response body gets its type, with an inline reason. Only error bodies are validated by hand (`parseApiError`); success bodies are trusted to match the contract. Runtime validation of responses is optional in the spec and left out.
- **Money throws on fractions.** A silent rounding would hide float arithmetic on prices; a thrown `RangeError` surfaces it in tests.
- **Mutations do not take a signal.** Only reads are cancellable. Aborting a write on the client does not undo it on the server, so callers would be left not knowing whether it applied; nothing in the spec needs it.
- **Empty bodies are valid.** Any 2xx with no body (204 or an empty 200) resolves to `undefined`.
- **New folders:** `src/domain` for pure domain logic shared by UI and mocks (status table, money), and `src/test` for Vitest setup. Neither was in the spec's folder list.

## Size

About 980 changed lines (including the PR description) excluding the lockfile, of which about 440 are tests. That is over the ~600 guideline. I kept it as one PR because splitting further would separate the client from its tests; say if you want it cut differently.

## Testing note

Client tests run against MSW, with one exception: the mid-body timeout test stubs `fetch`. Aborting a response mid-body makes undici throw an unrelated assertion when MSW closes the socket, so MSW cannot stage that case.

## How to verify

```sh
pnpm install
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Break the client on purpose to see the tests catch it: drop `&& token !== null` from the 401 check in `src/api/http.ts`, or remove the `options.signal?.aborted` pass-through in the `catch`.

## Review talking points

1. Failure taxonomy in `http.ts`: HTTP error vs no response vs caller abort, and why aborts are not wrapped.
2. Why the 401 handler depends on whether a token was sent, and why the client takes callbacks instead of importing a store.
3. The single `as` in `asResponse`: what is validated at the boundary and what is trusted.
4. `AbortSignal.timeout` + `AbortSignal.any` instead of manual timers, and how the timeout tests avoid fake timers.
5. The status table as the single source of truth, shared later by UI buttons and the mock API.
