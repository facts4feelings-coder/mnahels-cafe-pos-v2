# Installer Build & Local Run Guide

> Reference guide. Jab code perfect ho jaye aur naya installer chahiye ho, is file ko follow karein.

| | |
|---|---|
| Repository | `facts4feelings-coder/mnahels-cafe-pos-v2` |
| Default branch | `main` |
| Current version | `0.15.47` |
| Server port | `5055` |
| Credentials | `admin123 / admin123` and `cashier123 / cashier123` |
| Install key | `MNAHEL-POS-26-7K9Q-4X2M` |

---

## Part 1 - Local run (installer ke baghair)

Yeh default tareeqa hona chahiye. Changes dekhne ke liye installer install karne ki zarurat nahi.

### Ek dafa ka setup

| Tool | Kyun |
|---|---|
| .NET 8 SDK | Server aur desktop compile |
| Node.js 20+ | Patch scripts (`.cjs`) |
| Git | Clone / pull |
| WebView2 Runtime | Desktop shell |
| Inno Setup 6 | Sirf local installer ke liye |

### Clone se run tak

```powershell
git clone https://github.com/facts4feelings-coder/mnahels-cafe-pos-v2.git
cd mnahels-cafe-pos-v2
dotnet run --project src/MnahelsCafe.Pos/MnahelsCafe.Pos.csproj
```

Phir browser mein: `http://localhost:5055`

`dotnet run` khud hi saari patch scripts chala deta hai, kyunki `GenerateV42VisualAssets` target `BeforeTargets="PrepareForBuild"` par set hai. Is liye jo browser mein chal raha hai wo bilkul wahi hai jo installer mein jayega.

### Desktop window

Doosri PowerShell window (server chalta rehne dein):

```powershell
dotnet run --project src/MnahelsCafe.Desktop/MnahelsCafe.Desktop.csproj
```

### Naye changes ka loop

```powershell
git pull
dotnet run --project src/MnahelsCafe.Pos/MnahelsCafe.Pos.csproj
```

### publish-windows.ps1

Yeh script run nahi karti, self-contained publish karti hai (jo installer ke andar jata hai):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-windows.ps1
```

- Server + desktop dono ko `win-x64` ke liye `--self-contained true` publish karti hai
- Output: `publish\win-x64\`
- `MnahelsCafe.Pos.exe`, `MnahelsCafe.Desktop.exe`, `appsettings.json`, `wwwroot/index.html` verify karti hai, warna throw
- File count aur total MB print karti hai

Publish ke baad install ke baghair chalane ke liye:

```powershell
.\publish\win-x64\MnahelsCafe.Desktop.exe
```

### Local installer (optional)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-windows.ps1
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\MnahelsCafePOS.iss
```

Result: `installer\output\MnahelsCafePOS-Setup-<version>.exe`

---

## Part 2 - Installer build checklist

### 1. Latest state confirm karo

- `main` ka head commit SHA nikaalo
- Confirm karo pichla workflow run green tha. Red ke upar naya feature push na karo.

### 2. Version bump - chaaron jagah

Ek bhi jagah reh gayi to installer galat naam se banega ya titlebar purana version dikhayega.

| File | Kya badalna hai |
|---|---|
| `src/MnahelsCafe.Pos/MnahelsCafe.Pos.csproj` | `Version` |
| `src/MnahelsCafe.Desktop/MnahelsCafe.Desktop.csproj` | `Version` |
| `src/MnahelsCafe.Desktop/ReleaseDisplayVersion.cs` | `Current` + header comment (`Previous` ko na chhero) |
| `installer/MnahelsCafePOS.iss` | `MyAppVersion` aur `VersionInfoVersion` (4-part, e.g. `0.15.48.0`) |

Saath hi latest patch script ka `RELEASE` constant bhi bump karo.

### 3. Patch pipeline ka rule - sabse important

Repo ka `wwwroot` code waisa ship nahi hota. Build ke waqt `scripts/` ki scripts us par find-and-replace karti hain, phir compile hota hai.

```
apply-v42-runtime.cjs        -> v45 receipt, v57 assets
apply-v43-running-order.cjs  -> order editing schema, mapCart, v58 assets
apply-v44-hotfix.cjs         -> credentials, order log, v59 assets
apply-v47-order-console.cjs  -> v60 edit console, version stamp
apply-web-performance.cjs    -> final web tweaks
```

Rules:

- Purani `apply-v4x` script re-write NA karo. Naye kaam ke liye nayi `apply-v<next>.cjs` banao aur `MnahelsCafe.Pos.csproj` ke `GenerateV42VisualAssets` target mein naya `Exec` line add karo, `apply-web-performance.cjs` se pehle.
- Har naye patch mein `const lf = value => value.replace(/\r\n/g, '\n')` use karo. Windows runner CRLF deta hai; normalize na karne se `... source was not found` error aata hai.
- `replaceRequired()` pattern rakho: target text pehle se ho to short-circuit, warna throw. Isse silently galat build nahi banta.
- Script ke aakhir mein assertions + `new Function(js)` syntax check rakho.

### 4. Ek hi commit mein push karo

Saare related files ek push mein. Aadha push = red build.

### 5. Workflow verify karo

Chaaron jobs green hone chahiye:

| Job | Kaam |
|---|---|
| `build-server` | POS server compile + patch scripts |
| `test-running-order` | Order edit/cancel/delta tests |
| `build-desktop` | WebView2 desktop shell |
| `compile-installer` | Publish + Inno Setup se `.exe` |

Diagnostic endpoints:

```
/repos/{owner}/{repo}/actions/runs?head_sha={sha}&per_page=1
/repos/{owner}/{repo}/actions/runs/{runId}/jobs?per_page=20
/repos/{owner}/{repo}/check-runs/{jobId}/annotations?per_page=100
/repos/{owner}/{repo}/actions/runs/{runId}/artifacts?per_page=20
```

Job logs endpoint (`/actions/jobs/{id}/logs`) kaam nahi karta. Exact error ke liye hamesha annotations endpoint use karo.

### 6. Report karo

Run ID, artifact ID, byte size, `sha256`, expiry, installer filename.

---

## Part 3 - Download aur install

1. Actions page -> latest green run kholein
2. Artifacts -> `MnahelsCafePOS-Windows-Installer` download (zip)
3. Extract -> `MnahelsCafePOS-Setup-<version>.exe` chalayein
4. Install key daalein -> SERVER PC ya CASHIER PC choose karein
5. Titlebar par version check karein. Naya version na dikhe to `Ctrl+Shift+R`.

Artifact sirf 14 din rakha jata hai.

---

## Part 4 - Troubleshooting

| Problem | Wajah aur hal |
|---|---|
| `... source was not found` | Patch anchor badal gaya ya CRLF/LF mismatch. `lf()` check karein |
| Build red, error samajh nahi aaya | `check-runs/{jobId}/annotations` se exact line milti hai |
| Naye feature nahi dikh rahe | Cached JS/CSS. `Ctrl+Shift+R` ya titlebar version check |
| Titlebar par purana version | Version bump ki 4 jagah mein se koi reh gayi |
| Artifact download nahi ho raha | 14 din guzar gaye, naya build karein |
| `dotnet run` par port error | `5055` busy hai. `sc stop MnahelsCafePOS` |
| DB reset karna hai | `%ProgramData%\MnahelsCafePOS\mnahels-pos.db` delete karein |

---

_A product by Eastern Cross Technology - https://techmint.org_
