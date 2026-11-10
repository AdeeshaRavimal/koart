@echo off
title KOart Platform - Windows Desktop EXE Builder
color 0A
cd /d "%~dp0"

echo ========================================================================
echo   KOart Platform - Windows Desktop EXE Builder
echo ========================================================================
echo.

node -e "const p=require('./package.json'); console.log('Building Desktop App Version: v' + p.version);"
echo.

echo [1/4] Compiling Standalone Portable EXE and Unpacked App...
call npx electron-builder --win

if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Electron build failed. Make sure dependencies are installed.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Generating In-App Hot-Updater payload (updates\app.asar)...
if not exist "updates" mkdir "updates"
if not exist "public\updates" mkdir "public\updates"
if exist "dist-electron\win-unpacked\resources\app.asar" (
  copy /y "dist-electron\win-unpacked\resources\app.asar" "updates\app.asar" >nul
  copy /y "dist-electron\win-unpacked\resources\app.asar" "public\updates\app.asar" >nul
  node -e "const p=require('./package.json'); const fs=require('fs'); const d=JSON.stringify({ version: p.version, description: 'KOart Platform v' + p.version + ' hot-update payload' }, null, 2); fs.writeFileSync('updates/version.json', d); fs.writeFileSync('public/updates/version.json', d);"
  echo   Successfully generated updates\app.asar and updates\version.json
)

echo.
echo [3/4] Copying Portable EXE to workspace root...
if exist "dist-electron\KOart-Platform-Portable.exe" (
  copy /y "dist-electron\KOart-Platform-Portable.exe" "..\..\KOart-Platform-Portable.exe" >nul
  echo   Copied KOart-Platform-Portable.exe to root folder
)

echo.
echo [4/4] Build completed successfully!
echo ========================================================================
echo   PORTABLE EXE (Single File): dist-electron\KOart-Platform-Portable.exe
echo   ROOT PORTABLE EXE:          KOart-Platform-Portable.exe
echo   Executable Folder:          dist-electron\win-unpacked\KOart Platform.exe
echo   Hot-Update Payload:         updates\app.asar
echo ========================================================================
echo.

explorer "%~dp0dist-electron"

pause
