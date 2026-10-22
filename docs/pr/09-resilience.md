# PR 09 — Dev tools, resilience and accessibility pass

## What this adds

- **Dev tools panel** (demo build and `pnpm dev` only): a button at the bottom-left opens a panel to set the mock API's **latency** (none, fast, slow 3G, very slow), **server errors** (never, sometimes, always) and **offline**, each applied from the next request. **Reset network** returns to the defaults; **Reset demo data** restores the original menu and orders and reloads the page (the persistent mock database from PR 06c has no other way back). Escape closes the panel and returns focus to its button. The page reserves room for the button, so it never covers the footer or the admin sidebar. In a real production build the panel, like the mock API, is not in the bundle.
- **Offline banner**: shown from the browser's `online`/`offline` events and also for offline simulated in the panel, so a reviewer can see it. It is a status region that is always in the page, so the change is announced. `navigator.onLine` only says there is a network at all, so it is a hint: it never stops a request, and failed requests still show their own error states.
- **Error boundary** (`ErrorBoundary`, using `onErrorCaptured`) around the whole router view: a render error or an exception in an event handler shows a friendly fallback (try again, back to the menu) instead of a blank page, and is reported with `console.error`. Going to another page clears it.
- **Route accessibility**: the tab title names the page, and on a change of path focus moves to the new page's heading. A change of query (filters, order details) and the first page load leave focus alone.
- **Accessibility and performance pass**, written up in [`docs/accessibility.md`](../accessibility.md): heading order, labels, contrast of both themes, reduced motion, route splitting, image loading, layout shift, and the size of each route.

## Found by the pass, and fixed

- `--color-border-strong` (input, select and outlined button edges) was 1.7:1 on white in the light theme and 1.9:1 in the dark one, under the 3:1 that WCAG asks for the boundary of a control. Now at least 3:1 in both.
- The menu page shifted on load: the category chips grew by 4 px when they arrived, and the footer, visible under the short skeleton, was pushed out of view by the real list (CLS 0.096). Now 0 on desktop and phone.

## Decisions worth a look

- **The panel is a lazy chunk behind a build-time condition**, written out in `App.vue` as it is in `main.ts`: the bundler only removes the dead branch when it sees both operands replaced in the same file (a shared constant did not work, and the build output showed MSW in a real production build until it was inlined).
- **Offline simulation has two parts**: the mock API fails every request (`conditions.offline`), and a small shared flag (`simulateOffline`) feeds the same banner. The banner is shown when either the browser or the simulation says offline.
- **The error boundary is where the "one broken row must not take the page down" concern from the PR 08 review ends up**, rather than a guard in every component.
- **Focus goes to the heading, not to `main`**: a screen reader then announces the new page's name. The heading gets `tabindex="-1"` on demand, so it is not a Tab stop.

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
