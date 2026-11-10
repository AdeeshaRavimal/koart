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

echo [1/4] Compiling and packaging Electron Windows App...
call npx electron-builder --win dir

if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Electron build failed. Make sure dependencies are installed.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Generating In-App Hot-Updater payload (updates\app.asar)...
if not exist "updates" mkdir "updates"
if exist "dist-electron\win-unpacked\resources\app.asar" (
  copy /y "dist-electron\win-unpacked\resources\app.asar" "updates\app.asar" >nul
  node -e "const p=require('./package.json'); const fs=require('fs'); fs.writeFileSync('updates/version.json', JSON.stringify({ version: p.version, description: 'KOart Platform v' + p.version + ' hot-update payload' }, null, 2));"
  echo   Successfully generated updates\app.asar and updates\version.json
)

echo.
echo [3/4] Creating distribution zip (KOart-Platform-Windows.zip)...
tar.exe -a -c -f "dist-electron\KOart-Platform-Windows.zip" -C "dist-electron\win-unpacked" .
echo   Zip archive created successfully.

echo.
echo [4/4] Build completed successfully!
echo ========================================================================
echo   Executable Folder:  dist-electron\win-unpacked\KOart Platform.exe
echo   Zip Package:        dist-electron\KOart-Platform-Windows.zip
echo   Hot-Update Payload: updates\app.asar
echo ========================================================================
echo.

explorer "%~dp0dist-electron\win-unpacked"

pause
