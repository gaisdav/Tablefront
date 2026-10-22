# PR 09 — Dev tools, resilience and accessibility pass

## What this adds

- **Dev tools panel** (demo build and `pnpm dev` only): a button at the bottom-left opens a panel to set the mock API's **latency** (none, fast, slow 3G, very slow), **server errors** (never, sometimes, always) and **offline**, each applied from the next request. **Reset network** returns to the defaults; **Reset demo data** (asks to be clicked twice) restores the original menu and orders and reloads the page (the persistent mock database from PR 06c has no other way back). Escape closes the panel and returns focus to its button. The page reserves room for the button, so it never covers the footer or the admin sidebar. In a real production build the panel, like the mock API, is not in the bundle.
- **Offline banner** (a floating notice, so it moves nothing): shown from the browser's `online`/`offline` events and also for offline simulated in the panel, so a reviewer can see it. It is a status region that is always in the page, so the change is announced. `navigator.onLine` only says there is a network at all, so it is a hint: it never stops a request, and failed requests still show their own error states.
- **Error boundary** (`ErrorBoundary`, using `onErrorCaptured`) around the whole router view: a page that cannot be drawn shows a friendly fallback (try again, back to the menu) with focus on its heading, instead of a blank page. An error in an event handler or a watcher is one failed action, not a broken page: it is only reported (`console.error`) and the page and what the user typed stay. Going to another page clears the fallback.
- **Route accessibility**: the tab title names the page, and on a change of path focus moves to the new page's heading (or, for a page that draws it only after loading, to the content area first and on to the heading when it appears, unless the user has moved on). A change of query (filters, order details) and the first page load leave focus alone.
- **Accessibility and performance pass**, written up in [`docs/accessibility.md`](../accessibility.md): heading order, labels, contrast of both themes, reduced motion, route splitting, image loading, layout shift, and the size of each route.

## Found by the pass, and fixed

- The edge of inputs, selects, outlined buttons, the quantity stepper and the switch track was 1.7:1 on white in the light theme and 1.9:1 in the dark one, under the 3:1 that WCAG asks for the boundary of a control. They now use a new `--color-control-border` (at least 3:1 in both); `--color-border-strong` is unchanged for decoration.
- The menu page shifted on load: the category chips grew by 4 px when they arrived, and the footer, visible under the short skeleton, was pushed out of view by the real list (CLS 0.096). The skeleton now matches the chips and the proportions of a real card, and the shift is 0 at 375, 1200, 1440 and 1920 px.

## Decisions worth a look

- **The panel is a lazy chunk behind a build-time condition**, written out in `App.vue` as it is in `main.ts`: the bundler only removes the dead branch when it sees both operands replaced in the same file (a shared constant did not work, and the build output showed MSW in a real production build until it was inlined).
- **Offline simulation has two parts**: the mock API fails every request (`conditions.offline`), and a small shared flag (`simulateOffline`) feeds the same banner. The banner is shown when either the browser or the simulation says offline.
- **The error boundary is where the "one broken row must not take the page down" concern from the PR 08 review ends up**, rather than a guard in every component.
- **Focus goes to the heading, not to `main`**: a screen reader then announces the new page's name. The heading gets `tabindex="-1"` on demand, so it is not a Tab stop.

## Review follow-up

Fixed:

- `useOnline` registers its `online`/`offline` listeners once for the page instead of per call, so one component unmounting cannot stop the others.
- The error boundary replaces the page only for errors in showing it; errors in event handlers and watchers are reported and the page stays. The fallback gets focus (also after a failed retry), and its claim is now "your cart is kept on this device".
- Route focus looks for `h1` inside `main`, falls back to `main`, and follows a late heading with a short-lived observer.
- The offline banner is fixed-position, so it no longer pushes the layouts down.
- `has-devtools` is set in `App.vue` before the first paint (not when the lazy panel arrives), and the login page and the fallback subtract the reserved space like the layouts do.
- A new `--color-control-border` for controls; `--color-border-strong` goes back to its old value for decoration (switch track excepted: it is a control).
- The loading skeleton no longer forces a window-high box: it has twelve card-shaped placeholders instead.
- Dev tools: Escape acts (and stops) only while the panel is open, closing resets a pending reset, "Reset demo data" needs a second click, and a panel chunk that fails to load simply shows no panel.

Not changed:

- The dev-tools condition is still written in both `main.ts` and `App.vue`: it has to be, for the bundler to drop the panel from a real build; both carry a comment saying so.
- The boundary does not wrap the offline banner or the panel: they are not part of any page, and the panel's own load failure is handled where it is loaded.

## Not done, on purpose

- **No keyboard shortcut for the panel**: the visible button is easier to find, and a shortcut would need documenting and could clash with the page.
- **The panel's settings are not remembered across reloads**: a forced failure should not survive a refresh and leave a reviewer wondering why nothing works.
- **No automatic refresh when the connection returns**: pages that failed show their Retry; polling pages recover on their own.
- **No test with a real screen reader**, only structural and keyboard checks (see the accessibility notes).

## How it was checked

- `format:check`, `lint`, `typecheck`, `test` and `build` pass; a real production build contains neither the panel nor MSW, and the demo build contains both.
- Tests: the banner (browser events, simulated offline, both, clean-up), the error boundary (render error, handler error, try again, still failing, back to the menu, recovery on navigation), the panel (collapsed and open, current values, each setting, offline shows the banner, reset network, reset demo data, Escape and focus, room reserved at the bottom) and route accessibility (title, first page, focus on the heading, no scroll, query-only change, not a Tab stop, admin).
- Tests fail when their fix is removed: the clean-up of the listeners, both parts of the "offline" rule, the boundary reset on navigation and its `return false`, the first-page rule, the `tabindex`, `preventScroll`, the offline flag, the focus return, the data reset and the form sync after a network reset.
- In Chrome, light and dark, 1280 px and 375 px: the panel (screenshots), the offline banner, Escape, focus on the heading after navigation, the tab title, no console warnings or errors on any page, layout shift measured per page.
