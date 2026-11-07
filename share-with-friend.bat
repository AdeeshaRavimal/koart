@echo off
title KOart Platform - Live Internet Demo Tunnel
color 0C
echo ========================================================================
echo   KOart Solutions - Operational Platform Live Internet Tunnel
echo ========================================================================
echo.
echo  Starting a secure, temporary public HTTPS URL for your friend...
echo  Your local server on port 3000 will be accessible worldwide!
echo.
echo  * Share the generated https://...loca.lt link with your friend.
echo  * If prompted for a password on first visit, enter your public IP.
echo  * Keep this command window OPEN while your friend is testing.
echo.
echo ========================================================================
echo.
npx localtunnel --port 3000
pause

