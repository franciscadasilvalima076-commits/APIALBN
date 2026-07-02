import { LockManager } from './lock.js';
import { BackupManager } from './backup.js';
import { HealthMonitor } from './healthMonitor.js';
import { Logger } from './logger.js';
import * as fs from 'fs';
import * as path from 'path';

const logger = Logger.getInstance();

export async function runStartup(): Promise<boolean> {
  console.clear();
  console.log(`
=========================================================
      ██████╗ ██╗███╗   ██╗ █████╗ ███╗   ██╗ ██████╗███████╗
      ██╔══██╗██║████╗  ██║██╔══██╗████╗  ██║██╔════╝██╔════╝
      ██████╔╝██║██╔██╗ ██║███████║██╔██╗ ██║██║     █████╗  
      ██╔══██╗██║██║╚██╗██║██╔══██║██║╚██╗██║██║     ██╔══╝  
      ██████╔╝██║██║ ╚████║██║  ██║██║ ╚████║╚██████╗███████╗
      ╚══════╝ ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
      QUANT TRADING SUITE - HIGH PERFORMANCE SYSTEM v4.0.0
=========================================================
  `);

  logger.system('STARTUP', 'Executing Institutional-Grade Secure Boot Sequence...');

  // 1. Acquire Single Instance Lock
  const lockAcquired = LockManager.acquireLock();
  if (!lockAcquired) {
    logger.system('STARTUP', 'Boot blocked: another instance is already running.', 'ERROR');
    return false;
  }

  // 2. Check for State File Corruption and restore from Backup
  const stateFile = path.join(process.cwd(), 'trading_state.json');
  if (fs.existsSync(stateFile)) {
    try {
      const data = fs.readFileSync(stateFile, 'utf8');
      JSON.parse(data);
      logger.system('STARTUP', 'Trading state structure verified as HEALTHY.', 'SUCCESS');
      // Create fresh backup of healthy state
      BackupManager.backupFile('trading_state.json');
    } catch (e) {
      logger.system('STARTUP', 'CRITICAL! trading_state.json is CORRUPTED. Restoring from backup...', 'ERROR');
      const backupDir = path.join(process.cwd(), 'backups');
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('trading_state') && f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: path.join(backupDir, f),
            mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime()
          }))
          .sort((a, b) => b.mtime - a.mtime); // newest first

        if (files.length > 0) {
          fs.copyFileSync(files[0].path, stateFile);
          logger.system('STARTUP', `Successfully restored state from backup: ${files[0].name}`, 'SUCCESS');
        } else {
          logger.system('STARTUP', 'No healthy state backups found! Creating fresh empty state.', 'WARN');
          createFreshStateFile(stateFile);
        }
      } else {
        logger.system('STARTUP', 'No backup directory exists. Creating fresh state.', 'WARN');
        createFreshStateFile(stateFile);
      }
    }
  } else {
    logger.system('STARTUP', 'No trading_state.json found. Initializing fresh trading state.', 'INFO');
    createFreshStateFile(stateFile);
  }

  // 3. System Health Verification
  try {
    const stats = await HealthMonitor.getSystemStats();
    if (stats.status === 'CRITICAL') {
      logger.system('STARTUP', 'System health is CRITICAL. Boot halted.', 'ERROR');
      return false;
    }
    logger.system('STARTUP', `Pre-flight health check PASSED. Latency: ${stats.binancePingMs}ms`, 'SUCCESS');
  } catch (err) {
    logger.system('STARTUP', 'Pre-flight health check threw exception.', 'WARN');
  }

  logger.system('STARTUP', 'Boot Sequence completed successfully. System is ONLINE.', 'SUCCESS');
  return true;
}

function createFreshStateFile(filePath: string) {
  const defaultState = {
    balances: [
      { asset: 'USDT', free: 100000, locked: 0 },
      { asset: 'BTC', free: 0, locked: 0 },
      { asset: 'ETH', free: 0, locked: 0 },
      { asset: 'SOL', free: 0, locked: 0 }
    ],
    positions: [],
    orders: [],
    performanceLogs: [],
    emergencyKillSwitch: false,
    updatedAt: Date.now()
  };
  fs.writeFileSync(filePath, JSON.stringify(defaultState, null, 2), 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStartup().then(success => {
    if (!success) {
      process.exit(1);
    }
  });
}
export { createFreshStateFile };
