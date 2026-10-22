# PR 06b — My orders

Guests have no accounts, so nothing ties them to an order except the browser they placed it in. This adds a "My orders" page built on that: the browser remembers the ids of its orders, and the page asks the API for the current state of each.

## What this adds

- **`/orders` — My orders.** Orders that can still change come first ("In progress"), then the rest ("Earlier"), newest first. Each is a card with the status, a short list of the items, when it was placed, pickup or delivery and the total; the whole card is one link to the tracking page. Empty, loading and error states are handled like everywhere else.
- **Remembering orders** (`src/stores/myOrders.ts`, `myOrdersStorage.ts`): placing an order stores its id, newest first, in versioned `localStorage` (`tablefront:orders`), capped at 50. Only ids are stored: the state shown always comes from the API, never from a stale copy. Several tabs are handled: a change starts from what is saved as well as from what the tab holds, so a second tab cannot erase an order, and a `storage` event brings other tabs' changes in without a reload. Loading never throws: blocked, corrupt, foreign-version or hand-edited storage give an empty list (or just the valid ids), and a full or blocked storage keeps working in memory. Same approach as the cart.
- **Keeping it fresh** (`useMyOrders`, built on `usePolling`): only orders that can still change are asked about again, and polling ends by itself when all of them are over; hidden tabs and unmounting are handled by `usePolling`.
  - One order failing does not hide the others: it shows the last thing known about it, marked "could not refresh, status may be out of date", or, if it never loaded, "could not be loaded right now" among the orders in progress, without a Remove button (it is probably still live, and removing it would lose the only link to it).
  - Only when every request fails is the refresh an error, so the poller backs off instead of hammering a server that is down; the page keeps showing what it had, with a notice.
  - An order the server does not know (404) is shown as "no longer exists" with a Remove button, and is not asked about again.
- **The list can change while the page is open** (another tab, a removal): what was cached about forgotten orders is dropped, and a newly added id is asked about at once, even if polling had already ended.
- **Getting there:** an "Orders" link in the header, shown once there is something to show (an empty page is not worth the room on a phone), and "← My orders" at the top of an order page, only for someone who has orders (not for a shared tracking link).

## Decisions worth a look

- **Ids, not orders, in storage.** It keeps the page honest and the schema trivial, at the price of a request per active order. For that reason the list refreshes every 10 s rather than the 5 s of a single order page.
- **The page follows the remembered list immediately.** Removing an order does not wait for the next refresh.
- **No "clear history".** Past orders stay (up to the cap); only orders that no longer exist can be removed by hand. Enough for a demo; a real product would want it.
- **Status changes on the list are not announced to screen readers**, unlike on the single order page: a list of several orders changing quietly in the background would be noise. Each card carries the status as text.

## Worth knowing for the demo

The mock backend lives in the page's memory, so a full reload starts it from scratch. After a reload the remembered orders are therefore gone from the "server", and the page shows them as "no longer exists". That is the intended behaviour for that case, and a good reason for the state to exist, but it means orders placed before a reload cannot be followed. Persisting the mock database across reloads is a separate decision.

## How it was checked

- `format:check`, `lint`, `typecheck`, `test` and `build` pass.
- Tests: the store and storage failure modes (blocked, corrupt, other version, damaged entries, duplicates, cap, full storage), the presentation helpers, `useMyOrders` (order of ids, empty list, following an order, settling, 404, one failing order, keeping the last known state, every request failing) and the page (empty, ordering and sections, card content, missing order with removal, error with retry, a damaged list, the header link, the link back, and that checkout remembers an order only when it was placed).
- Tests fail when their fix is removed: de-duplication, caching of settled orders, the all-failed rule, keeping the last known state, the stop condition, following the remembered list, and remembering at checkout.
- In Chrome at 1280 px light and 375 px dark: the header link appears after the first order, the card opens the tracking page, no horizontal scrolling, no console messages.

## Review follow-up

Fixed: a second tab can no longer erase orders (merge on write plus `storage` sync); an order that could not be loaded stays among those in progress without Remove; a newly added id restarts a stopped poller and forgotten ids are pruned from the caches; a failed refresh of one order is marked on its card; the back link is hidden for a shared link (and the page has a single root); a cancelled request is never counted as a failure.

Not changed:

- No concurrency limit on the per-order requests: only orders that can still change are asked about, which for a person is a handful; the cap of 50 is for the remembered list, not for active orders.
- A 404 settles an order as missing for the life of the page, like the tracking page treats it. Reloading asks again, and Remove is the user's explicit choice.
