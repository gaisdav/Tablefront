# PR 05b — Quantity stepper on dish cards

A follow-up to the cart (PR 05), requested after trying it: adding a dish should not need the drawer to change how many.

## What changes

- **"Add" turns into `− 1 +`** on the dish card as soon as the dish is in the cart. `+` and `−` change the quantity; at 1 the `−` becomes a bin icon labelled "Remove <dish> from cart" and removes the dish, and the card shows "Add" again.
- **Focus follows the user.** The pressed button disappears, so focus would fall to the page. If focus was on it, it moves to `+` after Add and back to "Add" after removing the last one. This is decided by asking, just before the DOM is patched, whether focus is inside the card's action area: no flag, no timing between the click and the render (a slow or asynchronous store works), and focus that is elsewhere (the drawer, another card) is never taken. The stepper exposes `focusIncrease()` rather than the card reaching into its labels.
- **No double announcement.** The card's stepper is silent (`silent` prop on `QuantityStepper`, which renders a plain `span`: an `<output>` is a live region by itself, so removing `aria-live` is not enough): the header live region already says "Margherita pizza: 2 in cart. Cart total …". The drawer's steppers still speak for themselves, as before.
- **No layout jump.** "Add" and the stepper are both exactly one 44 px tap target tall (the stepper's frame is an outline, so it takes no room and its buttons keep the full 44 px; measured in Chrome), so the row, and with it the card, does not change height. Widths differ, as a button and a three-part control naturally do. The allergens and the action sit in a footer pushed to the bottom of the card, so they line up across a row whatever the description is, or whether there is one.
- The "N in cart" text is gone: the stepper shows the number.

`QuantityStepper` gets `removable` (the minus removes the last unit, whatever `min` is) and `silent`. `MenuItemCard` stays presentational: it emits `add` and `change-quantity` (0 means remove), `MenuPage` forwards them to the cart store.

## Worth knowing

- A real browser caught a bug in the first version of the focus handling (a pending-focus flag cleared before the store's change had rendered). The flag is gone entirely; an integration test through the whole app (focus Add, click, expect focus on `+`, remove, expect focus on Add) and a unit test with a deliberately slow parent guard it.
- At the maximum (99) `+` stays focusable and `aria-disabled`, as in the drawer.

## How it was checked

- `format:check`, `lint`, `typecheck`, `test`, `build` pass.
- Tests: stepper (`removable`, `silent`), card (Add vs stepper, emitted quantities, silence, focus in three situations) and the whole app (add, +, −, remove, back to Add, the announcement, focus).
- Tests fail when their fix is removed: the focus targets, the stale-focus expiry (including its ordering), `silent`, and the remove-at-one behaviour.
- Real Chrome at 1280 px light and 375 px dark: focus after Add and after remove, bin icon at one, the card height unchanged between states, no console messages.
