#!/bin/bash
echo "========================================================="
echo "      STARTING QUANT TRADING PLATFORM AUTONOMOUS LAUNCHER"
echo "========================================================="
echo "Checking environment requirements..."

# Check Node.js
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js is not installed or not in system PATH!"
    echo "Please install Node.js (v18 or higher)."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "[INFO] First time launch detected. Installing dependencies (npm install)..."
    npm install
fi

# Run pre-flight healthcheck
echo "[INFO] Running pre-flight system diagnostics..."
npx tsx src/automation/healthcheck.ts

# Start the Process Supervisor
echo "[INFO] Starting Autonomous Process Supervisor (including 12-hour recycling)..."
npx tsx src/automation/processManager.ts
