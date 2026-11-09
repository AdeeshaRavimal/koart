@echo off
title KOart Platform - Git Version Updater & Release Manager
color 0B
cd /d "%~dp0"

echo ========================================================================
echo   KOart Platform - Git Version Updater & Release Manager
echo ========================================================================
echo.
echo Current Repository: https://github.com/AdeeshaRavimal/koart.git
echo.

node -e "const p=require('./package.json'); console.log('Current Platform Version: v' + p.version);"

echo.
set /p NEW_VER="Enter NEW Version (e.g. 1.2.0, or press ENTER to keep current): "
if "%NEW_VER%"=="" (
  for /f "tokens=*" %%a in ('node -p "require('./package.json').version"') do set NEW_VER=%%a
)

echo.
set /p RELEASE_MSG="Enter Release Notes / Summary (or press ENTER for default): "
if "%RELEASE_MSG%"=="" set RELEASE_MSG=Version release v%NEW_VER%

echo.
echo [1/5] Updating package.json and cache-busters to v%NEW_VER%...
node -e "const fs=require('fs'); const p=require('./package.json'); p.version='%NEW_VER%'; fs.writeFileSync('./package.json', JSON.stringify(p, null, 4)); const h=fs.readFileSync('./public/index.html','utf8').replace(/platform-app\.js\?v=[^\"']+/g, 'platform-app.js?v=%NEW_VER%'); fs.writeFileSync('./public/index.html', h, 'utf8');"

echo [2/5] Staging files in Git...
git add .

echo [3/5] Committing release v%NEW_VER%...
git commit -m "release: v%NEW_VER% - %RELEASE_MSG%"

echo [4/5] Creating Git release tag v%NEW_VER%...
git tag -a "v%NEW_VER%" -m "%RELEASE_MSG%" -f

echo [5/5] Pushing to GitHub (branch + tags)...
git push adeesha main --tags

if %ERRORLEVEL% equ 0 (
  echo.
  echo ========================================================================
  echo   SUCCESS: Release v%NEW_VER% pushed to https://github.com/AdeeshaRavimal/koart!
  echo ========================================================================
) else (
  echo.
  echo [Notice] Standard push encountered an issue, attempting safe sync...
  git push adeesha main --tags --force
)

echo.
set /p SYNC_AWS="Would you also like to update the live AWS EC2 server (3.26.33.44) now? (Y/N): "
if /i "%SYNC_AWS%"=="Y" (
  echo.
  echo Updating AWS EC2 server at 3.26.33.44...
  if exist "C:\Users\Kannangara\Desktop\koart-key.pem" (
    ssh -i "C:\Users\Kannangara\Desktop\koart-key.pem" -o StrictHostKeyChecking=no ubuntu@3.26.33.44 "cd ~/koart && git stash && git pull origin main && pm2 restart koart"
    echo.
    echo AWS EC2 server updated and restarted online!
  ) else (
    echo Note: koart-key.pem not found on Desktop. Skipping remote server restart.
  )
)

echo.
set /p BUILD_DESKTOP="Would you also like to rebuild the Windows Desktop EXE for v%NEW_VER% now? (Y/N): "
if /i "%BUILD_DESKTOP%"=="Y" (
  call build-exe.bat
)

echo.
echo Version update completed successfully.
pause

