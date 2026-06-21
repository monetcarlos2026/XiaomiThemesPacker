@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo [1/4] Checking Node.js and npm...
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  echo Install Node.js, then run this script again.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found in PATH.
  exit /b 1
)

if not exist package.json (
  echo ERROR: package.json was not found in %cd%.
  exit /b 1
)

echo [2/4] Installing dependencies when needed...
if not exist node_modules (
  if exist package-lock.json (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 exit /b 1
) else (
  echo node_modules already exists, skipping install.
)

echo [3/4] Building renderer and Electron main process...
call npm run build
if errorlevel 1 exit /b 1

echo [4/4] Packaging Windows exe with electron-builder...
call npm run dist:win
if errorlevel 1 (
  echo.
  echo ERROR: electron-builder packaging failed.
  echo If it stopped while downloading Electron, check network access to GitHub or pre-populate the Electron cache.
  exit /b 1
)

echo.
echo Build complete. Check the release directory:
dir /b "%~dp0release\*.exe" 2>nul
exit /b 0
