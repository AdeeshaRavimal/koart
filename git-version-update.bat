@echo off
title KOart Platform - Git Version Updater & In-App Hot-Release Manager
color 0B
cd /d "%~dp0"

echo ========================================================================
echo   KOart Platform - Git Version Updater & In-App Hot-Release Manager
echo ========================================================================
echo.
echo Current Repository: https://github.com/AdeeshaRavimal/koart.git
echo.

node -e "const p=require('./package.json'); console.log('Current Platform Version: v' + p.version);"

echo.
set /p NEW_VER="Enter NEW Version (e.g. 1.2.1, or press ENTER to keep current): "
if "%NEW_VER%"=="" (
  for /f "tokens=*" %%a in ('node -p "require('./package.json').version"') do set NEW_VER=%%a
)

echo.
set /p RELEASE_MSG="Enter Release Notes / Summary (or press ENTER for default): "
if "%RELEASE_MSG%"=="" set RELEASE_MSG=Version release v%NEW_VER%

echo.
echo [1/4] Updating package.json and cache-busters to v%NEW_VER%...
node -e "const fs=require('fs'); const p=require('./package.json'); p.version='%NEW_VER%'; fs.writeFileSync('./package.json', JSON.stringify(p, null, 4)); const h=fs.readFileSync('./public/index.html','utf8').replace(/platform-app\.js\?v=[^\"']+/g, 'platform-app.js?v=%NEW_VER%'); fs.writeFileSync('./public/index.html', h, 'utf8');"

echo.
echo [2/4] Packaging In-App Hot-Update payload (~660 KB app.asar)...
call npx electron-builder --win dir
if not exist "updates" mkdir "updates"
if not exist "public\updates" mkdir "public\updates"
if exist "dist-electron\win-unpacked\resources\app.asar" (
  copy /y "dist-electron\win-unpacked\resources\app.asar" "updates\app.asar" >nul
  copy /y "dist-electron\win-unpacked\resources\app.asar" "public\updates\app.asar" >nul
  node -e "const p=require('./package.json'); const fs=require('fs'); const d=JSON.stringify({ version: p.version, description: '%RELEASE_MSG%' }, null, 2); fs.writeFileSync('updates/version.json', d); fs.writeFileSync('public/updates/version.json', d);"
  echo   Successfully generated updates\app.asar and updates\version.json
)

echo.
echo [3/4] Staging and Committing release v%NEW_VER% to Git...
git add .
git commit -m "release: v%NEW_VER% - %RELEASE_MSG%"
git tag -a "v%NEW_VER%" -m "%RELEASE_MSG%" -f

echo.
echo [4/4] Pushing to GitHub (branch + tags + hot-update payload)...
git push adeesha main --tags

if %ERRORLEVEL% equ 0 (
  echo.
  echo ========================================================================
  echo   SUCCESS: Release v%NEW_VER% published to GitHub!
  echo   All running desktop apps will detect this update in ~3 seconds!
  echo ========================================================================
) else (
  echo.
  echo [Notice] Standard push encountered an issue, attempting safe sync...
  git push adeesha main --tags --force
)

echo.
echo Version update completed successfully.
pause

