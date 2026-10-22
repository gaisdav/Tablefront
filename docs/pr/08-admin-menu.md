# PR 08 — Admin menu management

## What this adds

**`/admin/menu`**

- **The menu as a table** (cards on a phone): every dish, the sold-out ones too, with category, price and an availability switch. **Search** by name or description, instant (the dishes are already loaded), with the text kept in the URL.
- **Availability switch, optimistic**: the change shows at once and is undone, with a toast saying why, if the server refuses or the network fails. One change per dish at a time; a 401 stays quiet (the user is already being taken to the login page).
- **Add and edit in a dialog**, with the same hand-written validation approach as checkout and the same limits as the API (`src/domain/menuForm.ts`): inline messages, focus on the first problem, a message goes away as the field is fixed, one request however often it is submitted. The price is typed in euros (`11.50`, `11,5`) and converted to cents by parsing the text, never by floating point. **API errors** (`422`) are put on the right inputs (`priceCents` is the price input); a failure that belongs to no field appears in an alert and keeps what was typed.
- **Delete with confirmation**, and focus moves to the page heading when the row that had it is gone. A dish that was already deleted elsewhere counts as deleted.
- **Unsaved-changes guard**: while the form holds changes, _every_ way of closing it (Cancel, the close button, Escape, the backdrop) asks first, leaving the page through the router asks first, and closing or reloading the tab triggers the browser's own prompt. A form nobody touched closes without asking, and a form that was saved is not "dirty" any more.

New small building blocks: `BaseSelect`, `BaseCheckbox`, `ToggleSwitch`, a `multiline` option on `BaseInput`, `ConfirmDialog` with `useConfirm` (`await confirm({...})`), `useUnsavedChangesGuard`, `useAdminMenu`.

## Decisions worth a look

- **Two renderings, one data**: a real `<table>` where there is room and a list of cards on a phone (`useMediaQuery`), instead of a table bent into cards with CSS, which loses its table semantics.
- **One door for closing the form.** The dialog's `open` is a computed whose setter asks (`requestClose`), so the guard cannot be bypassed by a path someone forgets. The confirm dialog opens over the form dialog (focus trap and scroll lock stack, as already tested in PR 03b); "Cancel" is first in the confirm dialog, so focus starts there and Enter cannot discard by accident.
- **The form is created fresh each time the dialog opens** (the dialog does not render its content while closed), so nothing of a discarded draft leaks into the next one.
- **Only the availability switch is optimistic.** Create, edit and delete wait for the server: the form has to stay open to show its errors anyway, and deleting something should not appear to have worked when it did not (the spec asks for an optimistic toggle only).
- **Money.** `parseMoneyToCents` reads the text with a regex and integer arithmetic; `centsToInput` is its inverse. Both are tested against each other.

## Not done, on purpose

- **No category filter, sorting or pagination** on the table: twenty dishes do not need them, and the search covers finding one.
- **No image upload**: an optional address, validated as http(s) (or an inline image), like the API.
- **An availability change still in flight when the tab is closed is lost**; the guard covers the form, not a request on its way.

## How it was checked

- `format:check`, `lint`, `typecheck`, `test` and `build` pass.
- Tests: money parsing and formatting; the form rules and request building; the form component (new and existing dish, validation, focus, API errors, a failure with no field, double submit, dirty tracking including an undone change and allergens); the table and cards (both renderings, switch state and busy, Edit/Delete); `useAdminMenu` (loading, switch with apply, request body, rollback on refusal and network failure, quiet 401, no second change in flight, create in category order, update, 422 mapping, other failures, delete, delete of a dish already gone); `useConfirm`; the new fields; and the page end to end (list, search and URL, switch, add, edit, API errors, delete with Cancel and with confirmation, focus after a delete, closing a clean and a changed form, Escape, a fresh form after a discard, leaving the page with and without changes, the browser prompt only while there are changes, and none after leaving or saving).
- Tests fail when their fix is removed: the discard question, the leave-page guard, the browser prompt and removing its listener, closing after a save, deleting without an answer, rollback of the switch, the in-flight check, the 404-as-deleted rule, the confirm queue and double submit.
- In Chrome at 1280 px light and 375 px dark: the table and the cards, Escape on a typed form asks (focus on Cancel) and keeping it open works, add shows a toast and the new row, the switch, delete with its confirmation and focus on the heading, no console messages.
