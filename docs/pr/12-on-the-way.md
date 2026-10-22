# PR 12 — "On the way" for deliveries

## What this adds

- A new order status, **`out_for_delivery`** (shown as **On the way**), for deliveries only: `new → preparing → ready → out for delivery → completed`. A pickup is unchanged (`ready → completed`).
- **Staff:** a ready delivery offers one button, **Out for delivery**, then **Mark as completed**; a ready pickup only **Mark as completed**. The status filter has a new chip with its count, and the badge, the row and the toast use the new label.
- **Guests:** the order page shows a delivery as five steps (the new one between "Ready" and "Completed") and a pickup as four, announces the change ("Order status: On the way."), and keeps refreshing until the order is completed. "My orders" keeps an order that is on its way among those in progress.
- **Mock API:** `PATCH /admin/orders/:id/status` answers `409` for a move the order's fulfillment does not allow (a pickup sent out, a delivery completed straight from "ready", cancelling one that is on its way). A new seeded order (`ord-1008`, a delivery on its way) shows the state from the start.

## Decisions worth a look

- **The transition table is keyed by fulfillment** (`TRANSITIONS[fulfillment][status]`), written out in full for both, instead of one table plus exceptions: it reads as the two lifecycles it describes, and `canTransition`, `allowedTransitions`, the stepper's steps and the saved-data check all come from it. `canTransition` and `allowedTransitions` now take the fulfillment, so a caller cannot forget it.
- **No cancelling once the order is ready or on its way**, as before for "ready": the food is made, or out of the door.
- **The saved demo database rejects a pickup that is on the way**, like the other impossible combinations (a delivery with no address), so a hand-edited or damaged database is dropped. The shape of what is saved did not change, so a database saved before this change loads as it is.
- **This changes the status contract of the spec** (five statuses, one lifecycle for all orders); it is an extension, written down in `docs/DECISIONS.md`.
- **The stepper's width is set by the number of steps** (`--steps`), not by a fixed four; the first version wrapped the fifth step onto a second row, which was found by looking at it in Chrome.

## Not done, on purpose

- **No courier, no tracking on a map, no "estimated arrival"**: the status says the order has left, nothing more.
- **No way back** from "on the way" (a failed delivery): nothing in the spec asks for it.

## How it was checked

- `format:check`, `lint`, `typecheck`, `test` (920) and `build` pass; the end-to-end suite passes three runs in a row.
- Tests: every allowed and refused move for both kinds of order, that the two lists agree, that a pickup can never be on the way, the walk to "completed" for both; the API (`409`s, the whole delivery, the filter); the saved-data check; the buttons (detail panel, whole board: delivery from preparing to completed one saved change at a time, ready pickup, the filter and its count); the stepper (five steps, four steps, the column count); tracking (the courier step, announcement, still refreshing while on the way); "My orders"; and a new end-to-end journey, a delivery placed by a guest and taken out and completed by staff in another tab, plus a pickup never offered the courier.
- Tests fail when the rules are weakened: allowing "ready → completed" for a delivery, cancelling on the way, dropping the pickup check (in the rules and in the saved data), the stepper's delivery step, the wrong fulfillment in the board's or the API's check, and treating "on the way" as finished.
- In Chrome: the five-step stepper on the order page, the detail panel and the filter chip on the board; no console messages.
