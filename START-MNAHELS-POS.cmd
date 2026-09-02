@echo off
cd /d "%~dp0"
echo Starting Mnahel's Cafe POS v0.15.35...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RUN-APP.ps1"
if errorlevel 1 (
  echo.
  echo App start nahi hui. Upar wali error ki screenshot bhej dein.
  pause
)
