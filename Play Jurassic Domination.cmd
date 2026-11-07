@echo off
setlocal
cd /d "%~dp0"
if exist "release\Jurassic Domination-0.4.0-portable.exe" (
  start "" "release\Jurassic Domination-0.4.0-portable.exe"
  exit /b
)
if exist "release\win-unpacked\Jurassic Domination.exe" (
  start "" "release\win-unpacked\Jurassic Domination.exe"
  exit /b
)
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 or download the Windows executable from GitHub Releases.
  pause
  exit /b 1
)
set "ELECTRON_RUN_AS_NODE="
if not exist "node_modules\electron\dist\electron.exe" call npm.cmd ci
call npm.cmd run desktop
if errorlevel 1 pause
