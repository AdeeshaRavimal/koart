@echo off
title KOart - Multi-Tenant Operational & Task Management Platform
cd /d "%~dp0"

echo ====================================================================
echo   KOart Solutions - Operational & Task Management Platform
echo   Multi-Tenant SaaS Engine (Phase 1 Rollout)
echo ====================================================================
echo.
echo   Freeing port 3000 and terminating any stale node instances...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo   Launching backend REST API & Web Application on port 3000...
echo.

start "" "http://localhost:3000"
node server.js
pause
