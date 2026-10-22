# PR 05b — Quantity stepper on dish cards

A follow-up to the cart (PR 05), requested after trying it: adding a dish should not need the drawer to change how many.

## What changes

- **"Add" turns into `− 1 +`** on the dish card as soon as the dish is in the cart. `+` and `−` change the quantity; at 1 the `−` becomes a bin icon labelled "Remove <dish> from cart" and removes the dish, and the card shows "Add" again.
- **Focus follows the user.** The pressed button disappears, so focus would fall to the page. After Add it moves to `+`, after removing the last one it moves back to "Add". Only a change made on that card moves focus; the drawer or a notice changing the cart never steals it, and a click the parent ignored does not leave a pending focus behind.
- **No double announcement.** The card's stepper is silent (`silent` prop on `QuantityStepper`): the header live region already says "Margherita pizza: 2 in cart. Cart total …". The drawer's steppers still speak for themselves, as before.
- **No layout jump.** "Add" and the stepper are the same size (8rem × 44 px, measured in Chrome at both widths), so one turning into the other shifts nothing, and the card does not change size. Cards in a row now line up their allergens and Add/stepper along the bottom, which they did not before.
- The "N in cart" text is gone: the stepper shows the number.

`QuantityStepper` gets `removable` (the minus removes at the minimum) and `silent`. `MenuItemCard` stays presentational: it emits `add` and `change-quantity` (0 means remove), `MenuPage` forwards them to the cart store.

## Worth knowing

- A real browser caught a bug the unit tests had missed: the "pending focus" was cleared before the store's change had rendered, so focus was lost. It is now cleared after the emit, and an integration test through the whole app (click Add, expect focus on `+`, remove, expect focus on Add) guards it.
- At the maximum (99) `+` stays focusable and `aria-disabled`, as in the drawer.

## How it was checked

- `format:check`, `lint`, `typecheck`, `test`, `build` pass.
- Tests: stepper (`removable`, `silent`), card (Add vs stepper, emitted quantities, silence, focus in three situations) and the whole app (add, +, −, remove, back to Add, the announcement, focus).
- Tests fail when their fix is removed: the focus targets, the stale-focus expiry (including its ordering), `silent`, and the remove-at-one behaviour.
- Real Chrome at 1280 px light and 375 px dark: focus after Add and after remove, bin icon at one, the card height unchanged between states, no console messages.
