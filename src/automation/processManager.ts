import { fork, ChildProcess } from 'child_process';
import * as path from 'path';
import { Logger } from './logger.js';
import { BackupManager } from './backup.js';

const logger = Logger.getInstance();
const RECYCLING_INTERVAL_MS = 12 * 60 * 60 * 1000; // Exactly 12 hours

export class ProcessSupervisor {
  private child: ChildProcess | null = null;
  private serverFile = path.join(process.cwd(), 'server.ts');
  private recycleTimer: NodeJS.Timeout | null = null;

  public start() {
    logger.system('PROCESS_SUPERVISOR', 'Supervisor starting up...');
    this.spawnChild();
    this.scheduleRecycling();
  }

  private spawnChild() {
    if (this.child) {
      logger.system('PROCESS_SUPERVISOR', 'Child process already exists. Skipping spawn.');
      return;
    }

    logger.system('PROCESS_SUPERVISOR', 'Spawning main Trading Server...');

    // Fork the main server file using tsx since it's a TS file
    const tsxPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
    this.child = fork(this.serverFile, [], {
      execArgv: [],
      env: { ...process.env, SUPERVISOR_SPAWNED: 'true' }
    });

    this.child.on('message', (message: any) => {
      if (message && message.type === 'HEARTBEAT') {
        // Heartbeat received
      }
    });

    this.child.on('exit', (code, signal) => {
      logger.system('PROCESS_SUPERVISOR', `Trading Server exited with code ${code} and signal ${signal}`, code === 0 ? 'INFO' : 'ERROR');
      this.child = null;

      // Auto restart if not manually stopped
      logger.system('PROCESS_SUPERVISOR', 'Crash detection triggered. Auto-rebooting server in 5 seconds...', 'WARN');
      setTimeout(() => this.spawnChild(), 5000);
    });

    this.child.on('error', (err) => {
      logger.error('PROCESS_SUPERVISOR', 'Error in main Trading Server process', err);
    });
  }

  private scheduleRecycling() {
    if (this.recycleTimer) {
      clearInterval(this.recycleTimer);
    }

    logger.system('PROCESS_SUPERVISOR', `Scheduled automatic graceful recycling every 12 hours.`, 'INFO');

    this.recycleTimer = setInterval(async () => {
      logger.system('PROCESS_SUPERVISOR', '=== Scheduled 12-Hour Graceful Recycle Initiated ===', 'WARN');
      
      // Perform state backup
      logger.system('PROCESS_SUPERVISOR', 'Pre-recycle state backup in progress...');
      BackupManager.backupFile('trading_state.json');

      if (this.child) {
        logger.system('PROCESS_SUPERVISOR', 'Sending SIGTERM to child process for graceful stop...');
        this.child.kill('SIGTERM');

        // Give it 10 seconds to stop gracefully, then kill force if still active
        const targetChild = this.child;
        setTimeout(() => {
          if (targetChild && !targetChild.killed) {
            logger.system('PROCESS_SUPERVISOR', 'Force killing non-responsive child process...', 'WARN');
            targetChild.kill('SIGKILL');
          }
        }, 10000);
      }
    }, RECYCLING_INTERVAL_MS);
  }

  public stop() {
    logger.system('PROCESS_SUPERVISOR', 'Stopping supervisor and children...');
    if (this.recycleTimer) {
      clearInterval(this.recycleTimer);
    }
    if (this.child) {
      this.child.removeAllListeners('exit');
      this.child.kill('SIGTERM');
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const supervisor = new ProcessSupervisor();
  supervisor.start();
}
export default ProcessSupervisor;
