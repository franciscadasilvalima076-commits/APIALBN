@echo off
title QUANT TRADING SUITE - MANUAL/EMERGENCY RESTART
color 0C
echo =========================================================
echo       INITIATING SAFE PROCESS RECYCLE ^& RESTART
echo =========================================================

echo [INFO] Backing up trading state before restart...
call npx tsx -e "import { BackupManager } from './src/automation/backup.js'; BackupManager.backupFile('trading_state.json');"

echo [INFO] Stopping all active Node.js processes...
taskkill /f /im node.exe >nul 2>nul

echo [INFO] Cleaning execution lock file...
if exist bot.lock del bot.lock

echo [INFO] Relaunching Quant Trading Platform...
start cmd /c "launcher.bat"
echo [SUCCESS] System recycle completed!
timeout /t 3 >nul
