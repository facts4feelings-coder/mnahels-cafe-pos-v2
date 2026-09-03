# Mnahel's Cafe POS v0.15.40

## Logo clarity fix

- Startup now loads the full 256px ICO frame directly from the packaged asset instead of using Windows' low-resolution extracted application icon.
- Startup logo display is larger, sharp, centered and proportionally fitted.
- Text rendering uses anti-aliased grayscale rendering to avoid color fringing on dark backgrounds.
- App, login and sidebar logo surfaces use contain sizing so the full supplied mark stays visible without cropping.
- Receipt logo and receipt layout remain unchanged.

## Preserved behavior

- Automatic receipt JPG remains enabled and user-toggleable with duplicate-download protection.
- Post-order performance stabilization and booked-order cart editing remain active.
- Existing .NET 8 self-contained win-x64 and Inno Setup 6 installer method is unchanged.
