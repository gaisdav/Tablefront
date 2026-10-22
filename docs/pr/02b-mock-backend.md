# PR 02b — Mock backend (MSW handlers, store, failure hooks)

Second half of PR 02. The app can now talk to a complete fake REST API; nothing renders it yet.

## What changed

- **Handlers for every endpoint in the contract** (`src/mocks/handlers.ts`): categories, menu items, orders, login, admin orders, status changes and menu-item CRUD. All errors use the `{ error: { code, message, fields? } }` shape.
- **In-memory store** (`src/mocks/db.ts`) seeded from fixtures (`src/mocks/fixtures.ts`): 4 categories, 19 menu items (2 unavailable), 7 orders in mixed statuses. State lives in module memory, so it **resets on page reload**; tests reset it before every test.
- **Server-side validation** (`src/mocks/validation.ts`), hand-written. Field names in 422 responses (`customer.name`, `lines.1.quantity`, ...) are the contract the checkout form will map back onto its inputs in PR 06.
- **Failure-injection hooks** (`src/mocks/conditions.ts`): `setMockConditions({ latency, errorRate, offline })`. Latency profiles `fast` (300-700 ms, the default), `slow3g`, `verySlow`, and `none` (tests); error rate `off` / `sometimes` (20%) / `always`; `offline`. Every route passes through them. PR 09 adds the Dev tools panel on top.
- **Tests for the resource modules** (`menuApi`, `ordersApi`, `authApi`, `adminApi`) and the hooks, all against the MSW node server.
- Small refactor: `ALLERGENS`, `ORDER_STATUSES` and `FULFILLMENTS` became constants (the types are derived from them), with shared type guards in `src/domain/guards.ts`. The UI will need the same lists for filters and forms.

## Why (decisions and trade-offs)

- **One `route()` wrapper instead of per-handler boilerplate.** It applies latency, failures and offline mode, so no handler can forget them. `adminRoute()` adds the bearer-token check on top, so a missing 401 is impossible by construction.
- **The status table is not duplicated.** The PATCH handler calls `canTransition` from `src/domain/orderStatus.ts`, the same function the admin UI will use to decide which buttons to render. The 409 responses and the UI cannot disagree.
- **The server owns names and prices.** An order request only carries item ids, quantities and notes. The handler looks up current names and prices and stores them on the order as snapshots, and the total is computed there. A client cannot send its own price.
- **Validation builds the typed result instead of casting.** The request body is `unknown`; each field is checked and the validated value is assembled from the checked pieces, so there is no `as` in the mock backend.
- **Latency is `none` in tests, `fast` by default.** The default applies in the browser demo; `src/test/setup.ts` resets everything before each test, so tests stay deterministic and fast. Latency tests use fake timers and a stubbed `Math.random`.
- **Offline is a network error, not a status code.** It uses MSW's `HttpResponse.error()`, so the client sees what a real lost connection looks like (`status: 0`, `network_error`) and applies no latency.
- **Images are inline SVG data URIs.** The demo needs no binary assets and no external image host. Two items have `imageUrl: null` on purpose, to exercise the no-image fallback.
- **Menu item search and filtering run on the "server".** `q` matches name and description, case-insensitively, as in the contract.
- **Guest tracking by order id only.** Per the spec, `GET /orders/:id` needs no token. Ids are sequential in the mock; a real backend would use unguessable ones (noted for DECISIONS.md).

## Not in this PR

- Starting the **browser worker** (`setupWorker`, `public/mockServiceWorker.js`, enabling it in `main.ts` behind a demo flag). The first page that needs it (PR 04) wires it up; the production flag is documented in PR 10.
- The Dev tools panel (PR 09).
- Mock admin credentials are in `src/mocks/fixtures.ts` (`admin@tablefront.test` / `admin123`); the README documents them in PR 10.

## Size

About 1400 changed lines excluding the lockfile, but 340 of them are fixture data and 520 are tests, which leaves roughly 540 lines of logic. It stayed one PR because handlers, store, validation and hooks only make sense together, and the tests show them working. Say if you want it cut differently.

## How to verify

```sh
pnpm install
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Break a rule on purpose and watch the tests fail: replace `!canTransition(order.status, status)` with `false` in the PATCH handler, or `isAdmin(context.request)` with `true` in `adminRoute`.

## Review talking points

1. `route()` / `adminRoute()`: how latency, injected failures, offline mode and auth hang off one wrapper.
2. Why the server computes prices and totals, and what the order snapshot protects against.
3. How 422 field names are designed so the checkout form can map them to inputs.
4. The failure-injection model: what each switch does (offline vs error rate vs latency) and why tests run with latency `none`.
5. How the status transition table is shared between UI and mock API, and what the 409 tests pin down.
