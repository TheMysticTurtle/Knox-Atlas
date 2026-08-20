@echo off
setlocal
title Knox Atlas - Development Launcher
pushd "%~dp0"

echo.
echo   KNOX ATLAS
echo   Local development launcher
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js and npm were not found on PATH.
  echo Install Node.js LTS, then run this launcher again.
  goto :failed
)

where cargo.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] The Rust toolchain was not found on PATH.
  echo Install Rust with rustup, then run this launcher again.
  goto :failed
)

if not exist "node_modules\.package-lock.json" (
  echo [SETUP] Installing frontend dependencies...
  call npm.cmd install
  if errorlevel 1 goto :failed
)

echo [START] Opening Knox Atlas with live reload...
echo Keep this window open while testing. Press Ctrl+C here to stop the app.
echo.
call npm.cmd run desktop:dev
if errorlevel 1 goto :failed

popd
exit /b 0

:failed
echo.
echo Knox Atlas could not start. Review the error above.
pause
popd
exit /b 1
