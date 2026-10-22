# PR 03b — Async state, state components and dialog

Second half of PR 03. Everything the data-driven pages in Stage 1 and 2 will be built from.

## What changed

- **`useAsyncState`** (`src/composables`): `data`, `error`, `isLoading`, `execute`, `cancel`. Race-safe, cancels on unmount, re-runs when watched inputs change.
- **`AsyncBoundary`**: renders exactly one of error, loading, empty or content (or nothing while idle), with a slot for each. The content slot receives the data already narrowed to non-undefined.
- **`BaseSkeleton`**, **`EmptyState`**, **`ErrorState`**: the building blocks `AsyncBoundary` uses by default; each can be replaced per page.
- **`BaseDialog`**: modal with focus trap, Escape to close, focus returned to the opener, page scroll locked. A bottom sheet on a phone, a centred card from tablet width up.
- **`useFocusTrap`** and **`useScrollLock`**: the two behaviours behind the dialog, as composables.
- **Tests**: 15 for `useAsyncState` (races, cancellation, unmount, watch), the boundary states and their edge cases, the focus trap on its own, and the dialog's focus, Escape, backdrop, restore and scroll-lock behaviour.

## Why (decisions and trade-offs)

- **Only the latest run may write state.** Starting a run aborts the previous one _and_ a run that is no longer current has its result dropped, even if the fetcher ignores the abort signal. Abort alone is not enough: a response can already be on its way, or the fetcher may not pass the signal on. This is what stops a slow answer for "pi" from overwriting the answer for "pizza". The tests pin both halves, and I checked that removing either one makes them fail.
- **Data survives a re-run.** While a new run loads, `data` keeps the last result, so a search does not flash an empty page between keystrokes. `AsyncBoundary` shows the skeleton only when there is no data yet; a refresh keeps the content and sets `aria-busy`.
- **Error wins over stale data.** If a refresh fails, the user sees the error with a retry button rather than a list that quietly stopped being current.
- **Idle shows nothing.** The skeleton appears only while something is loading. Before a run starts (`immediate: false`) or after `cancel()`, with no data and no error, the boundary renders nothing rather than a "Loading" announcement for work that is not happening. With the default `immediate: true` there is no idle frame, because the run starts in `setup`.
- **Error text is vetted.** Messages from the API layer (`ApiError`) are written for users and shown as they are. Any other error (a `TypeError` from a bug, a library error) gets a generic sentence, so technical details do not reach the screen; a page can pass `errorMessage` to choose its own wording. This is the one place a base component imports from `src/api` (a type guard only, no calls).
- **A run's own `AbortError` is still an error.** Aborts caused by `execute()` or `cancel()` are ignored because the run is no longer current. If a fetcher aborts itself, that is a failure the user should see, not a silently blank view. The HTTP client turns its own timeout into an `ApiError`, so this does not occur on the normal path.
- **Watching is explicit** (`watch: [category, query]`) instead of auto-tracking whatever the fetcher happens to read. It is a few more characters at the call site and no hidden dependency on what is read before the first `await`.
- **`execute` never rejects.** Failures land in `error` (non-`Error` throws are wrapped), so a caller cannot forget a `catch` and leave an unhandled rejection.
- **`AsyncBoundary` is presentational.** It takes `data`, `error` and `isLoading` as props and emits `retry`; it knows nothing about stores or the API. Its generic is `T extends object`, which is all the API returns and what lets the slot hand over typed data.
- **Announcements.** The loading state is a `role="status"` region with a visually hidden "Loading"; the decorative skeleton shapes are `aria-hidden`. The error view is `role="alert"`.
- **Hand-written dialog instead of `<dialog>`.** The native element gives a focus trap and Escape handling for free, but jsdom does not implement `showModal()`, so the behaviour could not be tested, and the spec asks for the trap to be demonstrated. Cost: more code, and the page behind is not made `inert`; focus is contained by the trap and `aria-modal` tells assistive technology the rest is out of play.
- **The dialog focuses the first control in its content**, not the close button that comes first in the DOM, so a form dialog starts in its first field and a confirmation starts on Cancel. With nothing focusable it falls back to the close button.
- **Keys are caught on the document, not on the panel.** If the focused button is disabled or removed, focus falls to the page; a panel-level handler would then miss Escape and Tab. The trap keeps a stack of open traps and only the topmost answers the keyboard, so Escape closes the dialog on top and not the one underneath. Keystrokes during IME composition are ignored.
- **Tabbable means tabbable.** Wrap-around skips `hidden` and `inert` subtrees, `input[type=hidden]`, any element with a negative `tabindex`, and (where the browser supports `checkVisibility()`) anything not rendered.
- **A stale activation does nothing.** The trap waits a tick for the dialog to render before moving focus; it checks it is still wanted afterwards, so a dialog closed in that tick is not focused.
- **Backdrop dismissal needs the press to start _and_ end on the backdrop.** Dragging a text selection out of a field, or a press that begins on the backdrop and ends in the panel, does not close the dialog and lose unsaved input.
- **Scroll lock is a class on `<body>`**, reference-counted so closing the top dialog does not unlock the page. A class means releasing never has to restore a remembered `overflow` value that other code may have changed meanwhile. `html { scrollbar-gutter: stable }` stops the page shifting sideways when the scrollbar disappears.
- **Dialogs and the loading spinner respect reduced motion** through the global rule from PR 03a.

## Visual check

Headless Chrome, light and dark, 375 and 1280 px, with a temporary page that showed each state and the open dialog. The skeleton, error, empty and dialog views read correctly in both themes; the focused input shows the focus ring. The temporary page is not part of the PR.

## Size

About 1600 changed lines excluding the lockfile, of which about 860 are tests. Over the ~600 guideline again; the pieces share one concern (what a data view and a modal do) and are tested together.

## How to verify

```sh
pnpm install
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

To see the race protection fail: remove the `if (current === controller)` guard around `data.value = result` in `useAsyncState` and run the tests. To see the dialog trap fail: change `last.focus()` to `first.focus()` in `useFocusTrap`.

## Review talking points

1. Why abort plus a "still current?" check, and what each protects against.
2. Keeping previous data during a re-run, and the precedence in `AsyncBoundary` (error, loading, empty, content).
3. Why `execute` never rejects and `watch` is explicit.
4. The dialog's focus handling: initial focus, wrap-around, restore on close and on unmount, and why it is hand-written.
5. Document-level keys with a stack of traps, and the class-based reference-counted scroll lock, for nested dialogs.
