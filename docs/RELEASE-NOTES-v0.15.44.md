# Mnahel's Cafe POS v0.15.44

## Order workflow
- Fixed the persistent **Start order first** guard after the guided order setup completes, for both Admin and Cashier.
- Fixed the guided table picker so only the selected table keeps the active visual state.
- Preserved booked-order editing in the normal cart, including item add/remove/quantity changes, discount and note updates, and kitchen delta slips.

## Shift Details
- Added an order summary for total, successful/completed, active, cancelled and edited orders.
- Added a per-user breakdown for orders started, successful orders, edits and cancellations.
- Added a time-stamped order activity log showing the order token, action, user, role and details.

## Login, branding and desktop shell
- Set matching credentials: `admin123 / admin123` and `cashier123 / cashier123`.
- Updated the supplied Mnahel's logo asset for sharper welcome and title-bar rendering.
- Moved the time and signed-in user identity beside the version on the left side of the desktop title bar and refined the chip styling.

## Receipt output
- Added a one-download-per-slip guard so a single receipt action cannot create repeated JPG files.
- Manual downloads and distinct customer, kitchen, addition and cancellation slips remain available.

## Installer
- Version: `0.15.44`
- Installer: `MnahelsCafePOS-Setup-0.15.44.exe`
- Build remains the existing .NET 8 self-contained win-x64 publish followed by Inno Setup 6.