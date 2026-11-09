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

echo [1/3] Compiling and packaging Electron Windows App...
call npx electron-builder --win dir

if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Electron build failed. Make sure dependencies are installed.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Creating distribution zip (KOart-Platform-Windows.zip)...
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Set-Location 'dist-electron'; Compress-Archive -Path '.\win-unpacked\*' -DestinationPath '.\KOart-Platform-Windows.zip' -Force; Write-Host 'Zip archive created successfully.'"

echo.
echo [3/3] Build completed successfully!
echo ========================================================================
echo   Executable Folder:  dist-electron\win-unpacked\KOart Platform.exe
echo   Zip Package:        dist-electron\KOart-Platform-Windows.zip
echo ========================================================================
echo.

explorer "%~dp0dist-electron\win-unpacked"

pause
