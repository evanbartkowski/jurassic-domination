@echo off
setlocal
title Jurassic Domination
cd /d "%~dp0"

echo ===================================================
echo             JURASSIC DOMINATION
echo ===================================================
echo.

if exist "release\Jurassic Domination-0.8.0-portable.exe" (
  echo Launching portable Windows build...
  start "" "release\Jurassic Domination-0.8.0-portable.exe"
  exit /b 0
)

if exist "release\win-unpacked\Jurassic Domination.exe" (
  echo Launching unpacked Windows desktop build...
  start "" "release\win-unpacked\Jurassic Domination.exe"
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not found in your PATH.
  echo Please install Node.js 24 LTS or download the portable Windows release.
  echo.
  pause
  exit /b 1
)

set "ELECTRON_RUN_AS_NODE="

if exist "node_modules\electron\dist\electron.exe" (
  echo Starting Jurassic Domination Desktop Client...
  call npm.cmd run desktop
  if not errorlevel 1 exit /b 0
  echo Desktop mode could not start. Launching browser mode instead...
)

echo.
echo Preparing Jurassic Domination...
if not exist "dist\index.html" (
  echo Building game assets...
  call npm.cmd run build
)

echo.
echo Launching Jurassic Domination in your browser...
echo (Press Ctrl+C in this console to stop the local server)
echo.

start "" "http://localhost:5173"
call npx.cmd vite --port 5173
exit /b 0
