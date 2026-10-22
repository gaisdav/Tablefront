# PR 06 — Checkout and order tracking

## What this adds

- **Checkout page** (`/checkout`): name, phone, pickup or delivery, and an address that is only asked for (and required) when the order is delivered. A read-only summary sits next to the form on desktop and below it on a phone.
- **Hand-written validation** (`src/domain/checkout.ts`, pure functions, no library): the same rules the API applies, so most mistakes never reach the server. Messages appear inline, under the field, tied to it with `aria-describedby`, and the first invalid field is focused on submit. Nothing is shown while the user is still typing for the first time; after the first failed attempt each field is checked again as it is edited, so its message disappears the moment it is fixed.
- **Server errors** (`mapServerErrors`): a `422` carries `fields` (`customer.phone`, `lines.1.quantity`, ...). Customer fields are put back onto their inputs; problems with the order's lines (a dish sold out meanwhile) become sentences that name the dish and appear in an alert at the top of the form. Unknown keys are shown, never dropped. Any other failure (network, 5xx) shows its message in the same alert; what was typed and the cart are kept, so the user can try again.
- **Double-submit protection**: the button is in its `loading` state while the request runs (focus stays on it), and `submit()` itself returns early while a request is in flight, which also covers Enter and any other way of submitting.
- **On success**: navigate to `/orders/:id` with `replace` (Back does not return to a checkout with an empty cart), then clear the cart.
- **Order page** (`/orders/:id`): a status stepper (Received, Preparing, Ready, Completed) with `aria-current="step"` and hidden text for each step, so progress is not conveyed by colour alone; a cancelled order replaces the stepper with a message. Status changes are announced in a live region.
- **`usePolling`** (`src/composables/usePolling.ts`):
  - one request at a time; the wait starts when the response arrives, so a slow server never gets overlapping requests;
  - nothing is requested while the tab is hidden, and the next request goes out immediately when it is shown again;
  - after a failure the wait doubles (up to a cap) and a success resets it; the last good data stays on screen, with a notice that it could not be refreshed;
  - it ends by itself on a terminal status (`completed`, `cancelled`) or on an error that retrying cannot fix (an unknown order, any 4xx), and when the component is unmounted (the in-flight request is aborted);
  - `refresh()` requests now and restarts it, which is what "Try again" does.

## Decisions worth a look

- **Where logic lives.** Rules, request building and error mapping are plain functions in `src/domain/checkout.ts`, tested without a component. `CheckoutPage` only wires them to state. `OrderTracking` owns the poller, and `OrderPage` only reads the route and keys it by id, so opening another order starts a fresh poller.
- **`usePolling` is not `useAsyncState` in a loop.** It needs different rules (a timer that depends on the previous result, pausing, back-off, stopping), so it has its own small state machine rather than bending the other composable.
- **A refresh that fails does not replace the page.** The error boundary only takes over while there is no order to show.
- **The cart is cleared after navigating**, otherwise the checkout page would flash its empty state first. If the navigation itself failed the cart stays, which is the safe side.

## Not done on purpose

- **No idempotency key.** The API has none, so if the connection drops after the server has created the order but before the answer arrives, retrying creates a second order. A real backend would take a client-generated key; I did not invent one for a mock.
- **The checkout total is the cart's snapshot.** The cart is checked against the menu when it is opened; the order page then shows the server's real total.
- **The order id is the only secret** for viewing an order, as in the spec: there is no guest account.

## How it was checked

- `pnpm format:check`, `lint`, `typecheck`, `test` and `build` pass.
- Tests: validation rules (every rule, boundaries, phone formats), request building, server-error mapping, the page (inline errors and focus, live re-validation, success, history, double submit with `submit` events and button clicks, 422 on a field and on a line, a retry after a failure, a non-API error), the stepper, order tracking (progress, announcements, stopping on terminal status, 404, a failing refresh that recovers, unmount) and `usePolling` with fake timers (loop, no overlap, stop conditions, back-off and its cap, hidden tabs, cleanup).
- Tests fail when their fix is removed: the submit guard, focusing the invalid field, `replace` vs `push`, clearing the cart, back-off, resetting the back-off, disposing the poller, the in-flight guard and the 4xx rule.
- In a real browser (Chrome, 1280 px light and 375 px dark): an invalid submit shows all messages and focuses the name; a valid delivery order lands on the order page with the cart empty; no console errors.
- The test setup now stubs `window.scrollTo` (jsdom does not implement it), which removes the "not implemented" noise.
