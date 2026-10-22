# PR 07 — Admin sign-in and the orders board

_Stacked on PR 06c (`pr-06c-persistent-mock-db`): the base of this PR is that branch, so the diff shows only this PR. Once 06c is merged, GitHub retargets it to `main`._

## What this adds

**Sign-in and session**

- **`/admin/login`**: email and password with the same hand-written validation approach as checkout (inline messages, focus on the first problem, one request however often it is submitted). A wrong password shows the API's message in an alert and keeps what was typed, so one slip is easy to fix. The demo credentials are shown on the page.
- **Auth store** (`src/stores/auth.ts`): the token lives in `sessionStorage`, so a session ends with the tab and survives a reload. Storage that is blocked or full is not an error.
- **Route guard and central 401** (`src/auth/installSession.ts`, installed once at startup): a page with `meta.requiresAuth` sends a visitor without a session to the login page with `?redirect=<where they wanted to go>`; signed-in staff are taken past the login page. A 401 in the middle of a session ends it and goes to the login page, remembering the page. The return address is only followed if it stays on this site (`//evil.example`, `https://…`, `/\…` and the login page itself are refused).
- **Sign out** in the admin sidebar.

**The orders board** (`/admin/orders`)

- **List with a status filter** (chips with a count each); the filter and the selected order live in the URL, so a reload, a shared link and the back button keep the view. All orders are loaded and filtered on the page, so the counts are right and an order moved out of the filtered view stays open until closed.
- **Order details**: beside the list on a wide window, over it (a side sheet, built on `BaseDialog`) on a narrow one. Customer, a tappable phone number, how it is collected, items, total.
- **Status actions are exactly the allowed transitions** (`allowedTransitions`, the same source the mock API uses for its 409): a new order offers "Start preparing" and "Cancel order", a finished one offers nothing and says why. The buttons are not rendered rather than disabled.
- **Optimistic update with rollback** (`useAdminOrders`): the new status shows at once, in the list and in the details; if the API refuses (409) or the network fails, the old status comes back and an error toast says why. After a conflict the board asks the server what the order looks like now. A 401 stays quiet (the user is already being taken to the login page).
- **Auto-refresh** with `usePolling` (8 s, paused in a hidden tab, backs off on errors): the list is updated in place, so the selected order, the filter and the scroll position are untouched. A failing refresh keeps the list and says so.
- **Toasts** (`useToastsStore`, `ToastHost`): short messages that disappear on their own; an error is an alert, the rest are polite live-region messages.

## Decisions worth a look

- **Two races, handled on purpose.** (1) A refresh that _began before_ a change was saved but answers after still carries the old status; it must not flip the screen back. Each refresh is numbered, and a saved change is only dropped by a refresh that began after it (`settledAfterRefresh`). (2) A second change to an order while one is in flight is ignored, so changes to one order reach the server in order; different orders are independent. Both have tests that fail without the fix.
- **Focus follows the user.** Pressing "Start preparing" replaces the buttons; if focus was on one, it moves to the first new button, or to the panel when nothing is left to press. Focus elsewhere is never taken.
- **Same-page navigation keeps the scroll position.** `scrollBehavior` used to jump to the top on every navigation; for a query-only change (a filter, a selected row) it now stays put, which also benefits the menu filters.
- **`ChipGroup`** is the generic radio-chip row; the category chips are now a thin wrapper around it, and the status filter uses it too.
- **Where the token lives.** `sessionStorage` is readable by any script on the page, like any browser storage; a real backend would use an HttpOnly cookie. Written down here and in the storage module.

## Not done, on purpose

- **No confirmation before "Cancel order".** The spec does not ask for one and the rollback covers a failed request, but cancelling is final; a real product would confirm.
- **No announcement of newly arrived orders** and no sound: the list simply grows. Worth adding with a real kitchen.
- **The poll interval is not configurable from the page**; the composable takes it (tests use 20 ms).

## How it was checked

- `format:check`, `lint`, `typecheck`, `test` and `build` pass.
- Tests: auth store (sign in and out, reload, wrong credentials, blocked and full storage); the guard and the open-redirect rules, including a 401 mid-session and a slower request failing after the user was sent away; the login page; toasts with fake timers; `useAdminOrders` (loading, new orders, stop on 401, optimistic apply, confirmation, 409 rollback and re-read, network rollback, quiet 401, disallowed moves, no second change in flight, two orders at once, the stale-refresh race and a later refresh winning); the detail panel (buttons per status, none for finished orders, busy state, focus in three situations); the board page (list, counts, filter in the URL, narrow and wide details, links, optimistic change, rollback on 409 and on network failure, focus, selection and the very same rows surviving a refresh, a failing refresh, sign out).
- Tests fail when their fix is removed: the guard, the open-redirect check, the 401 handler's logout, the rollback, the in-flight check, the transition check, the re-read after a conflict, rendering buttons for finished orders, using the dialog on a wide window, the scroll rule, and the stale-refresh rule.
- In Chrome at 1280 px light and 375 px dark: redirected to the login page and back with the filter kept, a wrong password, sign-in, the optimistic change with focus on the next button and a toast, still signed in after a reload. The two console messages are the browser's own note about the deliberate 401 on a wrong password.

## Review follow-up

Fixed:

- A saved change is no longer dropped inside the refresh itself (a refresh cancelled after its answer arrived could remove it and flip the order back); whether it still applies is decided from the accepted answer.
- The return address after sign-in is resolved by the router (an address that is not a page of this app, lands on "not found", or is the login page falls back to the default) instead of being checked by string prefix; a 401 that arrives while a navigation is under way remembers where that navigation was going.
- The token is written to `sessionStorage` synchronously, so storage never lags behind the store.
- `scrollBehavior` keeps the position on a same-page navigation only when there was a page before; the first navigation starts at the top.
- On a narrow window the details open as a modal only because the user tapped a row, not for a link with `?order=` and not on a resize; tapping the selected row then opens them instead of closing.
- Chips are keyed by position (a value may be `undefined` or empty).
- A test shows that focus returns to the pressed button when the change is undone.

Not changed:

- A change that was saved is kept on screen if polling has stopped: it is the newest thing known (the server accepted it), and nothing newer can arrive. A refresh from "Try again" or "Refresh" replaces it.
- Focus when the actions disappear (an order becomes completed) already goes to the panel: the watcher runs before the DOM is patched, so the old actions are still there to ask; the "falls back to the panel" test covers it.
