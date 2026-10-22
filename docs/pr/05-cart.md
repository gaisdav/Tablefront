# PR 05 — Cart

Guests can add dishes to a cart, adjust quantities, leave a note per dish, and check the cart from the header. The cart survives a reload, and it copes with the menu having changed since it was saved.

## What changed

- **`useCartStore`** (Pinia, setup syntax): `add`, `setQuantity`, `setNote`, `remove`, `clear`, `reconcile`, `dismissNotice`, and derived `itemCount`, `subtotalCents`, `isEmpty`, `quantityOf`.
- **Persistence** (`cartStorage.ts`): saved to `localStorage` under a versioned key, loaded through a hand-written validator. It never throws.
- **Reconciliation**: the cart is compared with the current menu at startup and whenever the drawer opens. A dish that is gone or sold out is removed, a changed price is updated, and each is recorded as a notice the user sees.
- **UI**: `CartButton` in the header (live count), `CartDrawer` (a side panel on tablet and up, a bottom sheet on a phone), `CartLineItem`, `QuantityStepper`, and an "Add" button with an "N in cart" hint on every dish card.
- **`CartHost`** (`src/layouts`): the one smart piece that connects store, router and API to the presentational components, and makes the spoken announcements.
- `BaseDialog` gained a `placement="side"` variant, reused for the drawer, so the focus trap, Escape, focus restore and scroll lock are the same code as every other dialog.
- **Tests**: store maths, every storage failure mode, reconciliation, the drawer's keyboard behaviour, and the whole flow through the app against the mock backend.

## Why (decisions and trade-offs)

- **A line is a snapshot.** It stores the dish's name and unit price at the time it was added, so the cart renders without a request and can notice that the live price differs. Money stays in integer cents; totals are plain integer sums.
- **One line per dish.** Adding a dish again raises its quantity (capped at 99, the server's limit) and takes the latest name and price. A note belongs to the line. If the same dish with two different notes should be two lines, that is a product decision to revisit.
- **Persistence cannot take the app down.** Reading handles: storage blocked or throwing, text that is not JSON, JSON that is not an object, a missing or different schema version, lines that are not an array, and individual lines with a missing id, fractional or non-positive price, quantity out of range, an over-long note, or duplicates. Bad lines are dropped and good ones kept; a wrong version or garbage drops everything. Writing swallows quota and blocked-storage errors, so the cart keeps working in memory. Each case has a test. The next change overwrites a corrupt save with a good one.
- **The version is a guard, not a migration.** A saved cart under another schema version is discarded, not converted. For a cart that is the right trade: losing a few items beats loading a shape the code does not understand.
- **Reconcile against the guest menu.** The guest API only returns dishes that can be ordered now, so "not in the list" means gone or sold out. Notices explain what changed ("Lasagna is no longer available and was removed", "Margherita pizza now costs €12.50 (was €11.00)"); the header button gets a marker and its label says "has changes". It runs at startup (if the cart is not empty) and each time the drawer opens, and never for an empty cart. If the check fails, the drawer says prices could not be checked and leaves the cart alone; the server prices the order anyway.
- **Smart versus presentational.** `CartButton`, `CartDrawer`, `CartLineItem` and `QuantityStepper` take props and emit events; `CartHost` is the only place that touches the store, router and API. The menu page passes `cart.add` into the cards the same way.
- **Announcements.** A `role="status"` line says what happened ("Added Margherita pizza. Cart total €11.00."). It stays quiet while the drawer is open, because the stepper's own `output` is a polite live region. When the cart changes on its own, the notice is announced instead of "Removed Lasagna": one watcher decides, because two watchers wrote to the same message and the loser was not deterministic (a test caught this).
- **A stepper at its limit stays focusable.** `aria-disabled` plus ignoring the click, not `disabled`, so keyboard focus is not thrown back to the page as the user reaches 1 or 99. Removing a dish is a separate, labelled button, not minus-at-one.
- **Labels for assistive technology.** Buttons say which dish they act on ("Increase quantity" inside a group labelled "Quantity of Margherita pizza", "Remove Lemonade from cart", "Note for Lemonade"); the visible label stays short.
- **Not done on purpose:** syncing the cart between browser tabs (a `storage` event listener), and a delivery fee. Both would be easy to add and neither is in the spec.
- **Pinia 4.1.** The spec says Pinia without a version; 4.1 is current.

## Visual check

In a real Chrome at 1280 and 375 px, light and dark: the drawer with two lines and a note, the phone sheet with two notices and a scrolling body, and the dark theme. A scripted run: add dishes from the menu, open the cart, type a note, Escape returns focus to the cart button, reload keeps the cart and the note, a hand-written stale cart (old price, a sold-out dish) produces both notices and the announcement, and corrupt storage starts an empty cart with nothing in the console.

## Size

About 2100 changed lines excluding the lockfile, of which about 1300 are tests. That is far over the ~600 guideline: roughly 830 lines are the feature and the rest is the test suite the spec asks for (all cart maths, every persistence failure mode, the drawer's keyboard behaviour). The store, the UI and the host depend on each other, so I kept it together. Say if you want it split.

## How to verify

```sh
pnpm install
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm dev
```

In the browser: add a few dishes, open the cart with the keyboard (Tab to the cart button, Enter), change quantities, close with Escape, reload. To see the notices, paste into the console and reload:

```js
localStorage.setItem(
  'tablefront:cart',
  JSON.stringify({
    version: 1,
    lines: [
      {
        menuItemId: 'item-5',
        name: 'Margherita pizza',
        unitPriceCents: 900,
        quantity: 2,
        note: '',
      },
      { menuItemId: 'item-8', name: 'Lasagna', unitPriceCents: 1500, quantity: 1, note: '' },
    ],
  }),
)
```

## Review talking points

1. The line as a snapshot, and how reconciliation uses it.
2. The persistence failure modes: what is dropped, what is kept, and why a version mismatch discards instead of migrating.
3. Why `CartHost` is the only smart component, and how announcements are decided in one watcher.
4. Focus behaviour of the drawer: initial focus, trap, Escape, restore, and the stepper that stays focusable at its limit.
5. What the cart deliberately does not do yet (multi-tab sync, same dish with different notes as separate lines).

## Review follow-up

Fixed:

- Reconciling with an empty menu response is skipped, so a backend hiccup cannot wipe the cart.
- Adding a dish again at a different price now raises a `price-changed` notice instead of repricing the earlier units silently.
- `NaN` quantities are ignored by `add` and `setQuantity`.
- The live region is cleared before an identical message is repeated, so it is spoken again.

Not changed, on purpose:

- Multi-tab sync: a stated non-goal of this PR.
- Invalid saved lines and schema bumps are dropped: guessing a fix for data we cannot trust is worse than starting clean, and the server limits are the source of truth.
- The `-` button at 1 stays inert (`aria-disabled`); the separate Remove button is the explicit way to delete a line.
- Backdrop click pairs mousedown and mouseup on the backdrop itself; that is the intended guard against drags that end there.
- The unavailable-item `add` guard is a store invariant; the UI never offers the button for such dishes.
- The menu endpoint is not paginated.
