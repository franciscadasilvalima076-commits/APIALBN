@echo off
title QUANT TRADING SUITE - WATCHDOG SENTINEL
color 0E
echo =========================================================
echo       WATCHDOG SENTINEL RUNNING IN BACKGROUND (WINDOWS)
echo =========================================================

:loop
netstat -ano | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo [%date% %time%] [ALERT] Port 3000 is offline. Attempting to boot application...
    start cmd /k "launcher.bat"
) else (
    echo [%date% %time%] [OK] Port 3000 is listening and healthy.
)
timeout /t 30 >nul
goto loop
