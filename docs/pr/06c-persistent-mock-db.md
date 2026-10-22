# PR 06c — The demo remembers its data

The mock backend lived in the page's memory, so a reload wiped every order and menu edit: "My orders" then showed orders that "no longer exist", and a tracking link stopped working. In the browser build the mock database is now kept in `localStorage`.

## What changes

- **`src/mocks/dbStorage.ts`**: reads and writes the part of the database the demo changes (the menu items, the orders and the two number counters; categories cannot be edited, so they stay with the fixtures) under `tablefront:mock-db`, with a schema version.
- **`src/mocks/db.ts`**: `enableDbPersistence()` starts from what was saved and saves after every change (create, replace, delete, status change); `disableDbPersistence()` is its counterpart; `resetDb()` returns to the fixtures and, when persistence is on, replaces the saved copy too. That is what the "Reset demo data" button of the Dev tools (PR 09) will call.
- **`src/mocks/browser.ts`** switches persistence on. Tests import `db` directly and never do, so no state leaks between them.

## Decisions worth a look

- **All or nothing on load.** The cart keeps the valid lines of a damaged save; a database must not. A few quietly missing orders or menu items would look like bugs nobody could explain, so anything unreadable (not JSON, another version, a wrong type, a duplicate id, an unknown status, an unreadable date, a line with a bad quantity) means "start from the fixtures". It never throws, and storage that is blocked or full is not an error either: the demo keeps working in memory.
- **A fingerprint of the fixtures** is saved with the data, and a database grown from other fixtures is dropped, so changing a dish in the fixtures reaches returning visitors without anyone remembering to bump a number. `SCHEMA_VERSION` is only for a change in the _shape_ of what is saved.
- **Consistency, not just types.** A saved database must also make sense: totals equal the lines' sum, a delivery has an address and a pickup has none, menu items belong to a real category, and the id counters are past every id handed out (or the next record would reuse one).
- **Bounded.** Only the newest 200 orders are kept, so a demo used for a long time stays small enough to save (a save that fails is not an error, but then nothing would persist).
- **Only the changed part is saved**, not the whole database, so categories (and anything added to the fixtures later that cannot be edited) always come from the code.

## Worth knowing

- One database per browser, shared by every tab: every call into it first picks up what another tab saved (so two tabs cannot overwrite each other or hand out the same order id), unless this tab's last save failed, in which case its memory is newer than storage and is kept.
- Without a reset button, the way back to the fixtures is clearing site data; the Dev tools button arrives in PR 09.

## How it was checked

- `format:check`, `lint`, `typecheck`, `test` and `build` pass.
- Tests (two tabs, a page load is simulated by evaluating the module again): nothing written unless switched on; fixtures when nothing is saved; an order, a status change and menu create, replace and delete survive a reload, and numbering carries on; reset replaces the saved copy; switching persistence off stops saving; eleven kinds of damage and five kinds of unreadable text start from the fixtures; blocked and full storage; and that the browser entry point really switches it on.
- Tests fail when their fix is removed: saving, saving after a status change, saving on reset, the unique-id check, the version check and the browser switch.
- In Chrome: place an order, reload, the tracking page and "My orders" still show it (no "no longer exists"), a second reload as well, no console messages.

## Review follow-up

Fixed: two tabs now share one database (no lost orders, no reused ids); enabling persistence twice is harmless and a failed save never lets older storage replace newer memory; the fixtures fingerprint; cross-record consistency on load (totals, address rules, categories, counters); a cap on the number of orders.

Not changed:

- Prices and totals of zero are not accepted on load: the mock API itself rejects a price below one cent, so such data cannot exist; accepting it would only hide damage.
- `db` hands out its live objects. Every change goes through its methods (that is the module's contract, and the handlers follow it); copying on every read would hide a bug rather than prevent one.
