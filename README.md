# Mnahel's Cafe POS

A local-first café point-of-sale system built with **C# / ASP.NET Core**, SQLite and a modern WebView2 desktop UI. One Windows server can serve the cashier and admin screens over the local network.

## Included in v0.1

- Cashier POS with menu search, categories, variants/sizes, discount and notes
- Menu transcribed from the supplied Mnahel's Cafe images
- Customer receipt and kitchen ticket print previews
- Order token numbers, statuses, reprint-friendly receipt screen
- Admin live dashboard: sales, orders, average bill, active orders and top items
- Role-based login and audit log foundation
- SQLite database owned by one server process (safe for multiple browser clients)
- Downloadable timestamped database backup
- Self-contained Windows publishing script
- Inno Setup installer script and GitHub Actions installer build
- Responsive interface for desktop and tablet
- Dedicated Windows cashier/admin window with the Mnahel's taskbar icon

## Architecture

```text
Cashier browser ─┐
                 ├── ASP.NET Core server (port 5055) ── SQLite
Admin browser ───┘
```

Do **not** place the SQLite file on a shared network folder. Every client talks to the C# server; only that process opens the database.

## Demo accounts

- Cashier: `cashier` / `cashier123`
- Admin: `admin` / `admin123`

Change both passwords before a real launch. These values are for local testing only.

## Run for development

Requirements: .NET 8 SDK.

```powershell
cd src/MnahelsCafe.Pos
dotnet restore
dotnet run
```

Open `http://localhost:5055`.

### Test cashier and admin on one computer

1. Open Chrome and sign in as `cashier`.
2. Open Edge or an InPrivate window and sign in as `admin`.
3. Place an order in Chrome.
4. Watch it appear in Admin → Dashboard/Orders.
5. Click Customer preview and Kitchen preview. Your normal printer dialog works as the temporary thermal-printer simulator; choose **Save as PDF**.

## Build the Windows installer

### Automatic on GitHub

1. Open the repository's **Actions** tab.
2. Select **Build Windows installer**.
3. Click **Run workflow**.
4. Download `MnahelsCafePOS-Windows-Installer` from the finished run.

The workflow also runs after pushes to `main`.

### Build locally on Windows

1. Install .NET 8 SDK and Inno Setup 6.
2. Run `./scripts/publish-windows.ps1` in PowerShell.
3. Open `installer/MnahelsCafePOS.iss` in Inno Setup and click Compile.
4. Installer output appears in `installer/output`.

## Install and use on two computers

1. Install the setup on the always-on Admin/server computer.
2. Allow TCP port `5055` in Windows Firewall for the private network.
3. Find the server computer IPv4 address with `ipconfig`, for example `192.168.1.20`.
4. On the cashier computer open `http://192.168.1.20:5055`.
5. Use a wired LAN or reliable private Wi-Fi. Give the server a reserved/static IP.

Only the server computer needs the installer. Client computers use a browser and can add the URL as a desktop shortcut.

## Data and backups

On Windows, application data is stored under:

```text
C:\ProgramData\MnahelsCafePOS
```

Use Admin → **Download backup** daily and keep a copy on another drive or cloud folder. Restore tooling, direct thermal-printer routing, menu editing and automatic update signing are recommended before production rollout.

## Menu verification

See `docs/menu-transcription.md`. A few names in the image are difficult to read and must be confirmed with the café before launch.

## Production checklist

- Change demo passwords
- Verify every menu name and price
- Test 20+ orders and simultaneous admin/cashier use
- Configure customer and kitchen printers
- Add printer retry queue before silent auto-printing
- Confirm daily off-device backups
- Use a UPS for server, router and cashier
- Restrict port 5055 to the private LAN

## License

Private commercial project. Add a license only if the owner wants to open-source it.
