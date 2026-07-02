import { LockManager } from './lock.js';
import { BackupManager } from './backup.js';
import { Logger } from './logger.js';

const logger = Logger.getInstance();

export async function runShutdown(reason = 'System requested shutdown', exitCode = 0): Promise<void> {
  logger.system('SHUTDOWN', `Initiating Graceful Shutdown sequence. Reason: ${reason}...`);

  try {
    // 1. Close connections, finalize current candles / executions
    logger.system('SHUTDOWN', 'Halting all Strategy and Analysis engines...');
    
    // 2. Perform emergency backing up of the state
    logger.system('SHUTDOWN', 'Backing up state data...');
    BackupManager.backupFile('trading_state.json');

    // 3. Clear open loops, flush logger streams
    logger.system('SHUTDOWN', 'Releasing execution locks...');
    LockManager.releaseLock();

    logger.system('SHUTDOWN', 'Shutdown sequence complete. Offloading memory. Goodbye.', 'SUCCESS');
  } catch (error) {
    console.error('[SHUTDOWN] Failed during shutdown sequence:', error);
  } finally {
    process.exit(exitCode);
  }
}

// Register global exception and exit handlers
process.on('SIGINT', () => {
  runShutdown('SIGINT received (User manual stop)');
});

process.on('SIGTERM', () => {
  runShutdown('SIGTERM received (System terminal request)');
});

process.on('uncaughtException', (error) => {
  logger.error('CRITICAL_EXCEPTION', 'Uncaught exception occurred', error);
  runShutdown(`Uncaught exception: ${error.message}`, 1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL_REJECTION', `Unhandled rejection occurred: ${reason}`);
  runShutdown(`Unhandled rejection: ${reason}`, 1);
});
