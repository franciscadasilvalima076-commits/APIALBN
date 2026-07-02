import * as fs from 'fs';
import * as path from 'path';

export class LockManager {
  private static lockFile = path.join(process.cwd(), 'bot.lock');

  public static acquireLock(): boolean {
    try {
      if (fs.existsSync(this.lockFile)) {
        const pidStr = fs.readFileSync(this.lockFile, 'utf8').trim();
        const existingPid = parseInt(pidStr, 10);
        
        if (!isNaN(existingPid)) {
          // Check if process is still running
          try {
            process.kill(existingPid, 0); // signals 0 checks process existence without killing it
            console.error(`[LOCK] Bot is already running under PID: ${existingPid}. Aborting startup.`);
            return false;
          } catch (e: any) {
            if (e.code === 'EPERM') {
              console.error(`[LOCK] Bot process is running under PID: ${existingPid} but permission is denied. Aborting.`);
              return false;
            }
            // Process doesn't exist, we can overwrite the lock file
            console.log(`[LOCK] Stale lock file found for PID: ${existingPid}. Overwriting lock.`);
          }
        }
      }

      fs.writeFileSync(this.lockFile, process.pid.toString(), 'utf8');
      console.log(`[LOCK] Acquired execution lock for PID: ${process.pid}`);
      
      // Cleanup lock file on exit
      process.on('exit', () => {
        LockManager.releaseLock();
      });
      process.on('SIGINT', () => {
        LockManager.releaseLock();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        LockManager.releaseLock();
        process.exit(0);
      });

      return true;
    } catch (error) {
      console.error(`[LOCK] Failed to acquire lock file:`, error);
      return false;
    }
  }

  public static releaseLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        const pidStr = fs.readFileSync(this.lockFile, 'utf8').trim();
        if (pidStr === process.pid.toString()) {
          fs.unlinkSync(this.lockFile);
          console.log(`[LOCK] Released execution lock for PID: ${process.pid}`);
        }
      }
    } catch (error) {
      console.error(`[LOCK] Failed to release lock file:`, error);
    }
  }
}
