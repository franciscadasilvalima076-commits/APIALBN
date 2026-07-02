@echo off
title QUANT TRADING SUITE - LAUNCHER
color 0B
echo =========================================================
echo       STARTING QUANT TRADING PLATFORM AUTONOMOUS LAUNCHER
echo =========================================================
echo Checking environment requirements...

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in system PATH!
    echo Please install Node.js (v18 or higher) from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist node_modules (
    echo [INFO] First time launch detected. Installing dependencies (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
)

:: Run pre-flight healthcheck
echo [INFO] Running pre-flight system diagnostics...
call npx tsx src/automation/healthcheck.ts
if %errorlevel% neq 0 (
    echo [WARNING] Health check reported environment issues. Starting anyway...
)

:: Start the Process Supervisor (starts server + watchdog + 12h cycle)
echo [INFO] Starting Autonomous Process Supervisor (including 12-hour recycling)...
call npx tsx src/automation/processManager.ts
pause
