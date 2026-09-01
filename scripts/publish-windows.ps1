param(
    [string]$Runtime = 'win-x64'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$serverProject = Join-Path $root 'src/MnahelsCafe.Pos/MnahelsCafe.Pos.csproj'
$desktopProject = Join-Path $root 'src/MnahelsCafe.Desktop/MnahelsCafe.Desktop.csproj'
$out = Join-Path $root "publish/$Runtime"

foreach ($project in @($serverProject, $desktopProject)) {
    if (-not (Test-Path $project -PathType Leaf)) {
        throw "Project file not found: $project"
    }
}

Push-Location $root
try {
    Write-Host "Using .NET SDK $(dotnet --version)"
    Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
    New-Item $out -ItemType Directory -Force | Out-Null

    foreach ($project in @($serverProject, $desktopProject)) {
        Write-Host "Restoring $project for $Runtime"
        dotnet restore $project --runtime $Runtime --nologo
        if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed for $project." }

        Write-Host "Publishing $project"
        dotnet publish $project `
            -c Release `
            -r $Runtime `
            --self-contained true `
            --no-restore `
            --nologo `
            -o $out `
            /p:PublishReadyToRun=false `
            /p:DebugSymbols=false `
            /p:DebugType=None
        if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed for $project." }
    }

    $required = @(
        'MnahelsCafe.Pos.exe',
        'MnahelsCafe.Desktop.exe',
        'MnahelsCafe.Pos.runtimeconfig.json',
        'MnahelsCafe.Desktop.runtimeconfig.json',
        'appsettings.json',
        'wwwroot/index.html'
    )
    foreach ($relativePath in $required) {
        $path = Join-Path $out $relativePath
        if (-not (Test-Path $path -PathType Leaf)) {
            throw "Published output is incomplete; missing $relativePath"
        }
    }

    $files = @(Get-ChildItem $out -File -Recurse)
    if ($files.Count -eq 0) { throw 'Published output is empty.' }
    $bytes = ($files | Measure-Object Length -Sum).Sum
    Write-Host "Published $($files.Count) files to $out ($([math]::Round($bytes / 1MB, 2)) MB)."
}
finally {
    Pop-Location
}
