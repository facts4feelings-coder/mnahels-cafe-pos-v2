# v0.15.24 — Resource Focus + Receipt Readability

- Removed the idle circular marker and pointer focus after selecting a table, waiter, or rider; only the active selection keeps the check mark.
- Removed the native spinner and nested yellow focus box from both Cash received fields.
- Enlarged and centered receipt amount values, kitchen variant values, and quantity values in both axes.
- Made receipt item/meta text darker, heavier, and easier to read on thermal paper.
- Enlarged the service icon, receipt stamp, and masthead lettering while retaining the existing compact 74px banner height.
- Preserved the fixed item-detail line, negative left margin controls, forced 80mm driver printing, and Dine-in two-slip flow.

# v0.15.23 — Black Header + Negative Left Margin

- Flipped the compact receipt title bar to solid black with white cafe, service-mode, icon, and payment-stamp text.
- Ensured variant/unit-price detail such as `Regular · Rs 600 each` always starts on its own line below the item name.
- Added negative left-margin support from -8mm to +8mm and shifted the complete receipt instead of using invalid negative padding.
- Added a separate Left margin adjustment section in Settings with quick negative/positive buttons and dedicated preview controls.
- Preserved reliable forced 80mm printer-driver printing, long-name wrapping, and the two-slip Dine-in flow.

# v0.15.22 — Forced Reliable 80mm Print Route

- Compact v43 receipts now always use the installed printer driver's 80mm paper route, regardless of the older custom-paper checkbox value.
- This removes the custom media-size path that caused the Settings preview Print button to produce no receipt on the current printer.
- Duplicate legacy icon removal, one visible service icon, 12px readable font, compact white layout, and two-slip Dine-in behavior remain unchanged.

# v0.15.21 — Receipt Print Reliability Fix

- Restored the printer-driver 80mm paper path so Settings preview prints reliably on the installed thermal printer.
- Removed the legacy receipt decorator from the new compact receipt, eliminating the duplicate second icon and wasted header height.
- Added a CSS safety rule that hides any stale legacy icon if older code has already inserted one.
- Enforced the readable monospaced receipt font and migrated saved font sizes below 12px to 12px once.
- Preserved the compact white header, safe long-name wrapping, and the two-slip Dine-in flow.

# v0.15.20 — Compact 80mm Receipt

- Replaced the ink-heavy black receipt header with a compact white, outlined header for reliable thermal printing.
- Switched to a readable monospaced thermal-printer style and reduced vertical spacing to save paper.
- Added safe wrapping for long customer, waiter, rider, area, item, and note text so it stays inside its own box.
- Updated Settings > Receipt print size > Preview to show the exact compact receipt before printing.
- Set new/fallback receipt width to 80mm and kept automatic content-length printing.
- Preserved the two-slip Dine-in flow: Waiter/Payment Due + Kitchen for Pay Later, or Paid + Kitchen for Pay Now.

# Midnight Amber Theme Update

## Exact printed receipts and order-entry fixes — v0.15.19

- Approved Ledger Seal + torn-edge receipts now bypass raw-text printing and use the WebView HTML print path for the exact dark header, bordered tables, icons and stamps.
- Dine-in booking now prints exactly two slips: a payment-aware customer/waiter slip and a kitchen ticket. Pay Later uses a combined Waiter + Payment Due slip; Pay Now uses the Final Paid slip.
- Later payment completion still automatically prints the Final Paid receipt.
- Table, waiter and rider choices are enforced as single-select radio groups, and disabled resources show a prominent `BOOKED` label.
- The menu search input now resets after every successfully added item, including both single-variant and multi-variant products.
- Preserved the exact receipt attribution: `A product by TechMint Software Solutions`.
- Release: `0.15.19`; UI revision: `20260830-receipt-exact-19`.

## Ledger Seal receipts with torn thermal edges — v0.15.18

- Implemented the approved Option 03 receipt layout with Option 05 torn-paper top and bottom edges.
- Added clear Dine-in, Takeaway and Delivery icons plus prominent Kitchen, Paid, Payment Due and Waiter stamps.
- Added bordered order-information and item tables to customer, kitchen and waiter slips.
- Pay Later bookings now automatically print a temporary Payment Due customer slip in Dine-in, Takeaway and Delivery modes.
- Final Paid receipts automatically print after Pay Now bookings and after a later payment is completed; this also closes the Dine-in Pay Now print gap.
- ESC/POS raw printing now supports a reverse black header band, while HTML printing includes backgrounds for the approved dark masthead.
- Preserved the exact receipt attribution: `A product by TechMint Software Solutions`.
- Release: `0.15.18`; UI revision: `20260830-receipt-ledger-18`.

## Included

- Complete Midnight Amber visual layer for the POS and admin interface
- Dark mode by default with the existing light/dark toggle preserved
- Compact icon navigation for Dashboard, POS, Orders, Sales, Customers, Items and Setup
- Search-first cashier screen with the complete ordering workflow available through F2
- Food-photo product cards using eight locally bundled images
- Midnight Amber login screen and post-login transition animation
- Themed dashboard, orders, sales/reports, customers, menu management and settings screens
- Redesigned customer/kitchen receipt presentation with distinct Dine-in, Takeaway and Delivery icons
- English interface copy for the updated workflows
- Existing TechMint Software Solutions ownership and product attribution preserved
- Pre-existing JavaScript syntax issue in `v30.js` corrected

## Added files

- `src/MnahelsCafe.Pos/wwwroot/midnight-amber.css`
- `src/MnahelsCafe.Pos/wwwroot/midnight-amber.js`
- `src/MnahelsCafe.Pos/wwwroot/assets/food/*.jpg`

## Validation performed

- All frontend JavaScript files pass `node --check`.
- Automated browser QA passed 20 checks covering login, theme switching, search, food imagery, F2 workflow, admin navigation and receipt icons.
- Login, dark POS, light POS, F2 workflow, admin dashboard and settings were visually reviewed at 1440×900.

## Windows validation still required

The sandbox did not contain the .NET SDK, Windows WebView2 or thermal-printer drivers. Before production deployment, build the solution on Windows and test WebView2, F10 printer selection, customer/kitchen receipts and the installer with the intended hardware.

## Cache and old-layout fix — v0.15.2

- Added no-cache response headers for static UI assets.
- Added a unique Midnight Amber CSS/JavaScript revision to force fresh assets.
- The Windows WebView2 shell now clears its disk cache before loading the POS UI.
- Desktop navigation includes a UI revision query and startup log entries.
- Aligned server, desktop and installer versions to 0.15.2.
- This prevents an upgraded installation from reopening the legacy cached layout.

## Animated login update — v0.15.3

- Added a four-scene food background carousel using pizza, chicken/wings, burger and drinks imagery.
- Added slow cinematic pan/zoom movement with smooth cross-fades.
- Added an animated “Mnahel's Cafe · The World of Taste” brand lockup.
- Added staggered entrance motion for the logo, brand, headline, copy and login panel.
- Changed the login form defaults to the Admin demo account for review.
- Updated UI cache revision and aligned server, desktop and installer versions to 0.15.3.

- Added `RUN-APP.ps1` for one-command clean build and launch on Windows.

## Launcher hotfix — v0.15.3-r1

- Fixed the one-command launcher content root so ASP.NET serves the bundled `wwwroot` instead of returning 404 for Midnight Amber assets.
- The existing WindowsBase/WebView2 message remains a non-blocking build warning; both projects compile successfully.

## Floating gallery and visual orders — v0.15.4

- Reworked the login hero into three simultaneous floating food cards with entrance motion and 2.8-second image rotation.
- Reduced the hero headline and made the Mnahel's Cafe brand lockup more prominent.
- Added a stronger login-panel entrance transition.
- Changed the Admin default to `admin111`; legacy untouched default `admin123` databases migrate once, while custom passwords remain unchanged.
- Added password-field error highlighting with a red animated arrow.
- Rebuilt dashboard recent-order cards with product photographs, titles, customer details and totals in one compact row.
- Simplified dashboard order identity to `MC-{token}` only.


## Animated dashboard order cards — v0.15.5
- Applied selected design 01 to recent orders.
- Added three independently floating 1:1 food photographs with product titles and quantities.
- Made customer name and phone number prominent.
- Added distinct icons for Dine-in, Takeaway, Delivery, Cash, Card, Online and staff.
- Kept the single MC-token identifier and compact responsive layout.


## Inline booking and dashboard operations — v0.15.6

- Removed the recurring dashboard repaint that caused visible blinking.
- Dashboard order images now show every line item in compact 1:1 tiles and wrap to additional rows instead of showing `+1` / `+2`.
- Kept all desktop menu categories on one compact row and reduced product-card motion to a slight entrance/hover effect.
- Replaced the F2 modal wizard with an inline booking workspace: menu remains visible, search receives focus and the cart opens on the right.
- Moved customer name/phone/address into the inline cart; delivery address appears only for Delivery.
- Added four dine-in tables with server-side occupancy checks; a table is released when the order is completed or cancelled.
- Merged order operations into Dashboard and retired the separate Orders navigation entry.
- Added mode-specific stages: Dine-in (Booked, Served, Order Complete), Takeaway (Booked, Prepared, Order Complete), Delivery (Booked, Prepared, Delivered, Order Complete).
- Added a temporary receipt print action below the Dine-in Served stage.
- Preserved existing printing, data, licensing and TechMint ownership/attribution behavior.


## Service Hub, animated timeline and cash change — v0.15.7

- Matched the supplied animated compact card reference with staggered card entry, a travelling amber scan, floating square food photos and a stable no-repaint data loop.
- Replaced rectangular status controls with a connected, interactive order timeline.
- Placed the order mode directly under the order identifier and payment icon beside the total.
- Added **Service Hub** for adding and managing riders, waiters and named tables. Busy resources are faded and labelled Booked until their order completes or is cancelled.
- Delivery booking now requires an available rider; dine-in requires an available table and waiter.
- Dine-in booking automatically prepares waiter and kitchen receipts, with dashboard reprint controls.
- Added cash received and live change/remaining calculation, stored on the order and printed on receipts.
- Added an optional order note field and prints the note on customer, waiter and kitchen receipts.
- Added three editable Tin Pack menu products: Small, Medium and Large.
- Added a clear order-mode icon and assignment details to receipts.
- Added subtle app-wide entrance and hover motion while preserving reduced-motion support.
- Preserved all licensing, data, printing and TechMint ownership/attribution behavior.


## Stable order states and Midnight Amber cart — v0.15.8

- Stopped every legacy Dashboard order renderer from writing over the animated operations cards.
- Status changes now update only the selected order timeline; unchanged card DOM stays mounted.
- Added a short popup to the newly active state and removed the repeated whole-card scan/blink.
- Rebuilt the open cart from the supplied d1 Midnight Amber reference: square thumbnail, compact details, and pill quantity control.
- Set the desktop menu to six compact square photo cards per row with square imagery and always-visible pricing.
- Kept Service Hub assignments, order notes, cash/change, receipts, printing, Tin Pack, licensing, and TechMint attribution intact.
- Release: `0.15.8`; UI revision: `20260830-stable-8`.


## Idempotent SQLite schema upgrade — v0.15.9

- Startup now reads SQLite table metadata before adding upgrade columns.
- Existing columns are skipped cleanly instead of deliberately triggering and catching duplicate-column errors.
- Fresh and older databases still receive every missing customer, table, rider, waiter, cash, change, and product-icon column.
- Existing POS data is preserved; no table or column is deleted or rebuilt.
- Release: `0.15.9`; UI revision: `20260830-schema-9`.


## Windows desktop launch readiness fix — v0.15.10

- Fixed `RUN-APP.ps1` waiting for an obsolete CSS marker that could never match the current v37 release file.
- The launcher now verifies the exact v0.15.10 Midnight Amber marker and then starts the desktop window.
- Updated the successful readiness message, release metadata, build label, installer version, and cache revision.
- The MSB3277 line shown by the SDK remains a non-blocking warning; the build completes with 0 errors.
- Release: `0.15.10`; UI revision: `20260830-launch-10`.

## Guided order setup and inline menu variants — v0.15.11

- Removed the legacy variant modal. Multi-size products now reveal four priced choices inside the selected product card.
- Added five-column desktop menu cards, visible prices, hover action, and full arrow-key/Enter/Escape navigation with Amber focus feedback.
- New Order and F2 now open a two-step animated setup for Takeaway, Dine-in, or Delivery. Dine-in collects table/waiter; Delivery collects rider/address.
- Added token-linked safe customer defaults (`Customer_{Token}` and an 11-digit `0300...` phone) that clear on first focus and restore when left empty.
- Moved mode, customer and assignment details to a compact context strip above the menu; reduced the cart to items, note, totals, payment, cash/change and booking.
- Added `GET /api/orders/next-token`; existing order, assignment, receipt, printing, dashboard, schema-upgrade, licensing and attribution behavior is preserved.
- Release: `0.15.11`; UI revision: `20260830-flow-11`.

## Compact cart, percentage discount and photographed menu alignment — v0.15.12

- Rebalanced the checkout area so five normal cart lines fit before item scrolling is needed.
- Compressed the order note, totals, payment, cash/change and Book Order controls without hiding them.
- Rebuilt Discount as a clean text percentage field with no numeric arrows; the UI calculates the rupee discount and sends the correct amount to the existing order API and receipts.
- Aligned the seeded menu with both supplied menu photographs, including Chicken Lazania, Coffee and complete deal descriptions.
- Added Water / Mineral Water, Pepsi, Coca Cola, 7UP and 3 Pack categories with all requested sizes.
- Drink prices use current Pakistan online retail anchors plus approximately Rs 30; Red Bull 3 Pack uses three current 250ml units plus Rs 30.
- Existing databases receive the menu alignment once without deleting orders or overwriting later admin price edits.
- Release: `0.15.12`; UI revision: `20260830-menu-12`.

## Midnight Amber motion, maintenance safety and dashboard scopes — v0.15.13
- Added the reference lift-and-arc menu-to-cart motion, a landing pulse and an independent animated order-confirmation card.
- Renamed Items to Menu Manager and POS to Our Menu; Service Hub is fixed as the fourth admin navigation item.
- Added a prominent animated customer/order context strip and stronger quantity/variant labels on dashboard food tiles.
- Added protected Setup > Database flash. It requires the exact phrase `mnahel’s_cafe_wipe_db`; business records reset while accounts, licensing/activation and backup files are preserved, then the default menu and four tables are restored.
- Added dedicated Water, Pepsi, Coca Cola, 7UP, Red Bull, Wrap, Salad, Sauce, Deal and Tin Pack imagery across menu, cart and dashboard cards.
- Removed Average bill and Discounts headline cards from Sales and made revenue-bar values permanently visible.
- Dashboard order operations now defaults to Today and supports Today, Yesterday, 7 Days and Month; the seven-day view has individual clickable day chips.
- Release: `0.15.13`; UI revision: `20260830-motion-13`.

## Order-first booking and practical payment settlement — v0.15.14
- Separated operational order status from payment status: new orders can be Booked + Unpaid or booked with optional Pay now.
- Added a cashier-friendly Due payments queue on Our Menu and payment actions on Dashboard order cards.
- Added full late-payment dialog with Cash/Card/Online, live cash change, quick tender buttons and optional card/online reference.
- Unpaid orders cannot be completed; Complete Order opens payment and full payment saves Paid + Completed atomically.
- Dine-in tables/waiters release after paid completion; delivery riders release at Delivered while payment may remain due.
- Added distinct provisional `PAYMENT DUE` bills and final paid receipts, while booking continues to print kitchen/waiter slips.
- Corrected revenue/accounting so only paid non-cancelled orders count as sales; added Booked active, Outstanding and paid Cash sales metrics.
- Existing pre-v0.15.14 orders migrate as Paid, preserving historical sales. Partial/split payment and refund/void remain future workflows.
- Release: `0.15.14`; UI revision: `20260830-pay-later-14`.

## Desktop window launch reliability — v0.15.15
- Corrected the v41 readiness marker that prevented RUN-APP from reaching the desktop launch step.
- The local server now starts hidden instead of covering the application window.
- RUN-APP now launches the built Windows GUI apphost directly, verifies it remains alive, and shows a clear WebView2 repair message if startup fails.
- Release: `0.15.15`; UI revision: `20260830-launch-15`.

## New-order search and cash UI cleanup — v0.15.16
- Menu search now resets immediately after a successful booking and when New order is started.
- Removed the Exact / Round 500 / Round 1,000 shortcut row from both instant and late cash payment.
- Removed the bright cash-input focus frame shown when Pay now was opened; manual amount entry remains available.
- Release: `0.15.16`; UI revision: `20260830-reset-16`.

## Cashier workspace and menu keyboard polish — v0.15.17
- Normalizes the built-in `cashier` account to the Cashier role on startup, including existing databases that carried the wrong role.
- Cashier navigation now contains only Order Tracking and Our Menu; Order Tracking reuses the live admin dashboard/order workflow without exposing admin tools.
- Our Menu is directly below Dashboard for administrators.
- Order-note typing no longer triggers the selected menu card when Space is pressed, and POS input focus rings are removed.
- Left/right and up/down keyboard entry from menu search now produce the same visible product border.
- Category tabs now show icon above the full category name below.
- Added final handover documentation for continuation in a new chat.
- Release: `0.15.17`; UI revision: `20260830-cashier-17`.
