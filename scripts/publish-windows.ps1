$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$serverProject = Join-Path $root 'src/MnahelsCafe.Pos/MnahelsCafe.Pos.csproj'
$desktopProject = Join-Path $root 'src/MnahelsCafe.Desktop/MnahelsCafe.Desktop.csproj'
$out = Join-Path $root 'publish/win-x64'
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
dotnet restore $serverProject
dotnet publish $serverProject -c Release -r win-x64 --self-contained true -o $out /p:PublishReadyToRun=true
dotnet restore $desktopProject
dotnet publish $desktopProject -c Release -r win-x64 --self-contained true -o $out /p:PublishReadyToRun=true
Write-Host "Published to $out"
Write-Host "Compile installer/MnahelsCafePOS.iss with Inno Setup next."
