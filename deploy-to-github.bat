@echo off
title Push KOart Platform to GitHub
color 0A
cd /d "%~dp0"
echo ========================================================================
echo   KOart Solutions - Push Operational Platform to GitHub (for Render)
echo ========================================================================
echo.
echo Target Repository: https://github.com/AdeeshaRavimal/koart
echo.

if not exist .git (
  echo Initializing local Git repository...
  git init
  git branch -M main
  git remote add origin https://github.com/AdeeshaRavimal/koart.git
) else (
  echo Updating Git remote origin...
  git remote set-url origin https://github.com/AdeeshaRavimal/koart.git
)

echo.
echo Staging and committing files...
git add .
git commit -m "Deploy KOart Multi-Tenant Operational Platform to Render"

echo.
echo Pushing to GitHub (main branch)...
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
  echo ========================================================================
  echo   SUCCESS: Code pushed to https://github.com/AdeeshaRavimal/koart!
  echo ========================================================================
) else (
  echo.
  echo [Notice] If the push was rejected because the remote has commits,
  echo trying force push...
  git push -u origin main --force
)

echo.
pause
