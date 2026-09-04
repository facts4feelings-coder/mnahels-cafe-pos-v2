# Mnahel's Cafe POS v0.15.47

_A product by Eastern Cross Technology · https://techmint.org_

## Today's order log on the shift dashboard

- The **Today's order log** panel now renders as a **full-width panel directly under the metric tiles** on the Admin dashboard. Previously it was injected inside the two-column `.admin-grid`, which squeezed it into a narrow column where it was easy to miss.
- The dashboard log now shows the **latest 20 order actions** (was 12) with actor, role, exact change and timestamp.
- If the order-log endpoint fails, the panel now prints the **real server message** instead of staying blank, and the Refresh button surfaces a toast.
- The Shift Details order log, Z-report `ORDER ACTIVITY` block and shift-closing preview are unchanged and still carry the full audit.

## "Request failed" on Edit order is fixed

- `GET /api/orders/{id}/edit` is no longer a hard dependency. The new order-edit console tries that endpoint first, and if it returns anything other than a usable payload it **falls back to the already-loaded order** from `GET /api/orders?take=200` and opens the cart anyway.
- The generic `Request failed` toast is gone. Any real failure now reports the **HTTP status and the server's own message**.
- Server side, the edit loader is wrapped in a guard: a missing product catalog no longer throws, and unexpected errors return `Order edit load failed: <reason>` so the cause is visible instead of hidden.
- Cart mapping no longer throws when a booked item is missing from the live menu. It falls back to the stored `unitPrice`, product name and variant name.

## Prominent yellow Edit order button, top right

- **Edit order** now sits in the **card header on the right side**, styled as a prominent gold/yellow button with an ✎ glyph, hover lift and focus ring.
- The old bottom action strip is fully removed on both the Admin dashboard cards and the Cashier order cards.
- The button only appears for editable orders: status `New`, `Confirmed`, `Preparing` or `Ready`, not `Cancelled`, and not already `Paid`.
- Available to **both Admin and Cashier**.

## Preserved from v0.15.46

- Reopening an active order returns to the **same cart** with `originalQuantity` tracking.
- Reducing a booked line to `0` keeps the row in the cart as a red **CANCELLED** line; partial reductions show as partial cancellations and are restorable with `+`.
- Amendments stay **delta-based**: the `RUNNING ORDER` slip prints only newly added items, and `RUNNING ORDER — CANCELLATION` prints only the cancelled item and quantity. Both show previous vs updated bill. Previously printed items never re-enter the kitchen queue.
- Every booking, status change, completion, cancellation and item add/remove records the exact Admin/Cashier account, role and timestamp.
- Receipt print de-duplication (one slip, not seven) and the HD welcome logo are unchanged.

## Build

- New `scripts/apply-v47-order-console.cjs` runs after `apply-v44-hotfix.cjs` in the existing `GenerateV42VisualAssets` target. Same regex-patch pipeline as before — no new build technique.
- It stamps `0.15.47` across `v56.js`, `v57.js`, `v59.js`, `v60.js` and `index.html`, injects `v60.css` / `v60.js` after the v59 assets, then runs 13 assertions plus `new Function(...)` syntax validation on every overlay before the build is allowed to continue.
- All patch inputs are normalised with `lf()` so Windows CRLF checkouts keep matching.
- Installer output: `MnahelsCafePOS-Setup-0.15.47.exe`
