$ErrorActionPreference = "Stop"
$buildVersion = "0.15.33"
$uiRevision = "20260901-performance-service-32"

# Relaunch as Administrator when needed.
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
    exit
}

$root = $PSScriptRoot
$serverProject = Join-Path $root "src\MnahelsCafe.Pos\MnahelsCafe.Pos.csproj"
$desktopProject = Join-Path $root "src\MnahelsCafe.Desktop\MnahelsCafe.Desktop.csproj"
$serverDirectory = Split-Path $serverProject -Parent
$themeFile = Join-Path $root "src\MnahelsCafe.Pos\wwwroot\midnight-amber.css"
$releaseFile = Join-Path $root "src\MnahelsCafe.Pos\wwwroot\v54.css"

Write-Host "`nMnahel's Cafe POS v$buildVersion" -ForegroundColor Yellow
Write-Host "Preparing Midnight Amber...`n" -ForegroundColor Cyan

if (-not (Test-Path $serverProject) -or -not (Test-Path $desktopProject) -or -not (Test-Path $themeFile) -or -not (Test-Path $releaseFile)) {
    throw "Required project or Midnight Amber files are missing. Extract the complete v$buildVersion ZIP first."
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET 8 SDK is not installed."
}

if (-not (dotnet --list-sdks | Select-String "^8\.")) {
    throw ".NET 8 SDK is required."
}

# Stop the old installed server so it cannot serve the legacy UI on port 5055.
Stop-Service -Name "MnahelsCafePOS" -Force -ErrorAction SilentlyContinue
Get-Process -Name "MnahelsCafe.Pos" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "MnahelsCafe.Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$portProcessIds = Get-NetTCPConnection -LocalPort 5055 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $portProcessIds) {
    if ($processId -gt 4) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

Remove-Item "$env:LOCALAPPDATA\MnahelsCafePOS\WebView2-Cashier" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\MnahelsCafePOS\WebView2-Admin" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Building updated app..." -ForegroundColor Cyan
& dotnet restore $serverProject
if ($LASTEXITCODE -ne 0) { throw "Server restore failed." }
& dotnet restore $desktopProject
if ($LASTEXITCODE -ne 0) { throw "Desktop restore failed." }
& dotnet build $serverProject --configuration Release --no-restore
if ($LASTEXITCODE -ne 0) { throw "Server build failed." }
& dotnet build $desktopProject --configuration Release --no-restore
if ($LASTEXITCODE -ne 0) { throw "Desktop build failed." }

$serverDll = Get-ChildItem (Join-Path $root "src\MnahelsCafe.Pos\bin\Release") -Recurse -Filter "MnahelsCafe.Pos.dll" |
    Select-Object -First 1 -ExpandProperty FullName
$desktopDll = Get-ChildItem (Join-Path $root "src\MnahelsCafe.Desktop\bin\Release") -Recurse -Filter "MnahelsCafe.Desktop.dll" |
    Select-Object -First 1 -ExpandProperty FullName
$desktopExe = Get-ChildItem (Join-Path $root "src\MnahelsCafe.Desktop\bin\Release") -Recurse -Filter "MnahelsCafe.Desktop.exe" |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $serverDll -or (-not $desktopExe -and -not $desktopDll)) {
    throw "Build output was not found."
}

Write-Host "Starting new local server..." -ForegroundColor Cyan
$serverProcess = Start-Process dotnet -ArgumentList @("`"$serverDll`"", "--urls", "http://localhost:5055", "--contentRoot", "`"$serverDirectory`"") -WorkingDirectory $serverDirectory -WindowStyle Hidden -PassThru

$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest "http://localhost:5055/v54.js?v=$uiRevision" -UseBasicParsing -TimeoutSec 2
        $expectedBuild = [regex]::Escape("const BUILD='$buildVersion'")
        $expectedRevision = [regex]::Escape($uiRevision)
        if ($response.StatusCode -eq 200 -and $response.Content -match $expectedBuild -and $response.Content -match $expectedRevision) {
            $ready = $true
            break
        }
    } catch {
    }
}

if (-not $ready) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    throw "Mnahel's Cafe POS v$buildVersion server did not become ready on port 5055."
}

Write-Host "Mnahel's Cafe POS v$buildVersion verified. Starting app..." -ForegroundColor Green

$desktopProcess = $null
try {
    $desktopDirectory = if ($desktopExe) { Split-Path $desktopExe -Parent } else { Split-Path $desktopDll -Parent }
    if ($desktopExe) {
        $desktopProcess = Start-Process $desktopExe -WorkingDirectory $desktopDirectory -PassThru
    } else {
        $desktopProcess = Start-Process dotnet -ArgumentList @("`"$desktopDll`"") -WorkingDirectory $desktopDirectory -PassThru
    }

    Start-Sleep -Seconds 3
    if ($desktopProcess.HasExited) {
        throw "Desktop app immediately close ho gayi. Microsoft Edge WebView2 Runtime install/repair karke dobara RUN-APP.ps1 chalayein."
    }

    Write-Host "Desktop app window started. Is PowerShell window ko app band hone tak close na karein." -ForegroundColor Green
    Wait-Process -Id $desktopProcess.Id
} finally {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
}
