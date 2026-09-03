# Mnahel's Cafe POS v0.15.39

## Fixes

- Restored automatic receipt JPG download and enabled it once for installations affected by the previous forced-off setting.
- Kept the automatic JPG setting user-controlled and retained duplicate-download protection.
- Applied the supplied Mnahel's Cafe logo to application branding, login/sidebar marks, Windows icon, favicon, and startup screen.
- Left the receipt logo and receipt layout unchanged.
- Replaced the visible native startup panel with a cached raster animation, centered typography, smoother easing, and a lighter paint path.
- Reduced recurring UI work after an order, gated order polling to the active admin screen, removed stale fly-to-cart elements, and stopped replaying menu animations.
- Preserved the standard-cart booked-order editing workflow from v0.15.38.

## Installer

Built with the existing .NET 8 self-contained `win-x64` and Inno Setup 6 workflow.

Expected file: `MnahelsCafePOS-Setup-0.15.39.exe`
