import { HealthMonitor } from './healthMonitor.js';
import { Logger } from './logger.js';
import * as http from 'http';

const logger = Logger.getInstance();
const PING_INTERVAL_MS = 30000; // 30 seconds
const PORT = 3000;

export class Watchdog {
  private static timer: NodeJS.Timeout | null = null;
  private static failureCount = 0;

  public static start() {
    logger.system('WATCHDOG', 'Watchdog health sentinel is active.');
    
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      await this.checkHealth();
    }, PING_INTERVAL_MS);
  }

  private static async checkHealth() {
    const stats = await HealthMonitor.getSystemStats();
    
    logger.performance('WATCHDOG', stats.binancePingMs, `System performance indicators: CPU ${stats.cpuLoad[0].toFixed(2)} | Process Memory: ${stats.processMemoryMb}MB | Internet: ${stats.internetLatencyMs}ms`);

    // Verify local API is responding on Port 3000
    const apiResponding = await this.verifyApiResponding();

    if (!apiResponding) {
      this.failureCount++;
      logger.system('WATCHDOG', `Local API on port ${PORT} failed to respond. Failures: ${this.failureCount}/3`, 'WARN');

      if (this.failureCount >= 3) {
        logger.system('WATCHDOG', 'CRITICAL! Local API unresponsive for 3 consecutive checkups. Triggering system recovery!', 'ERROR');
        this.rebootProcess();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private static verifyApiResponding(): Promise<boolean> {
    return new Promise((resolve) => {
      const options = {
        host: '127.0.0.1',
        port: PORT,
        path: '/api/health',
        timeout: 5000,
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  private static rebootProcess() {
    logger.system('WATCHDOG', 'Initiating automated emergency crash-reboot.', 'ERROR');
    // For supervisor spawned instances, we can trigger process.exit(1), and supervisor will revive it.
    process.exit(1);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.system('WATCHDOG', 'Watchdog health sentinel disabled.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  Watchdog.start();
}
