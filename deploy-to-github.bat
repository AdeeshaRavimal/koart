@echo off
title Push KOart Platform to GitHub
color 0A
cd /d "%~dp0"
echo ========================================================================
echo   KOart Solutions - Push Operational Platform to GitHub
echo ========================================================================
echo.
echo Target Repository: https://github.com/AdeeshaRavimal/koart.git
echo.

git remote get-url adeesha >nul 2>&1
if %ERRORLEVEL% neq 0 (
  git remote add adeesha https://github.com/AdeeshaRavimal/koart.git
) else (
  git remote set-url adeesha https://github.com/AdeeshaRavimal/koart.git
)

echo Staging all changes...
git add .

set /p MSG="Enter commit message (or press ENTER for default): "
if "%MSG%"=="" set MSG=Update platform codebase and configuration

echo Committing...
git commit -m "%MSG%"

echo.
echo Pushing to GitHub (adeesha main)...
git push -u adeesha main

if %ERRORLEVEL% equ 0 (
  echo.
  echo ========================================================================
  echo   SUCCESS: Code pushed to https://github.com/AdeeshaRavimal/koart!
  echo ========================================================================
) else (
  echo.
  echo [Notice] Standard push failed, checking with force push...
  git push -u adeesha main --force
)

echo.
pause
