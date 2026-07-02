import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private static instance: Logger;
  private logDir = path.join(process.cwd(), 'logs');

  private constructor() {
    this.ensureLogDirectoryExists();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirectoryExists() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeLog(filename: string, module: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'PERF', message: string, stacktrace?: string) {
    this.ensureLogDirectoryExists();
    const filePath = path.join(this.logDir, filename);
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${level}] [${module}] ${message}`;
    if (stacktrace) {
      logLine += `\nStacktrace:\n${stacktrace}`;
    }
    logLine += '\n';

    // Append asynchronously to protect performance
    fs.appendFile(filePath, logLine, (err) => {
      if (err) {
        console.error(`Failed to write log to ${filename}:`, err);
      }
    });

    // Also write errors to error.log
    if (level === 'ERROR' && filename !== 'error.log') {
      this.writeLog('error.log', module, level, message, stacktrace);
    }
  }

  public system(module: string, message: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') {
    this.writeLog('system.log', module, level, message);
    console.log(`[SYS] [${level}] [${module}] ${message}`);
  }

  public trading(module: string, message: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') {
    this.writeLog('trading.log', module, level, message);
    console.log(`[TRADE] [${level}] [${module}] ${message}`);
  }

  public binance(module: string, message: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') {
    this.writeLog('binance.log', module, level, message);
  }

  public ai(module: string, message: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') {
    this.writeLog('ai.log', module, level, message);
    console.log(`[AI] [${level}] [${module}] ${message}`);
  }

  public error(module: string, message: string, errorObj?: any) {
    const stack = errorObj instanceof Error ? errorObj.stack : undefined;
    const msg = errorObj instanceof Error ? errorObj.message : String(errorObj || '');
    const combinedMessage = `${message}${msg ? ' | Details: ' + msg : ''}`;
    this.writeLog('error.log', module, 'ERROR', combinedMessage, stack);
    console.error(`[ERR] [${module}] ${combinedMessage}`);
  }

  public performance(module: string, durationMs: number, message: string) {
    const msg = `${message} | Duration: ${durationMs}ms`;
    this.writeLog('performance.log', module, 'PERF', msg);
  }

  public order(id: string, symbol: string, side: string, qty: number, price: number | string, status: string, message = '') {
    const msg = `Order ID: ${id} | Symbol: ${symbol} | Side: ${side} | Qty: ${qty} | Price: ${price} | Status: ${status} ${message ? '| ' + message : ''}`;
    this.writeLog('orders.log', 'ORDER_ENGINE', 'INFO', msg);
    console.log(`[ORDER] ${msg}`);
  }

  public getRecentLogs(filename: string, limit = 50): Promise<string[]> {
    return new Promise((resolve) => {
      const filePath = path.join(this.logDir, filename);
      if (!fs.existsSync(filePath)) {
        return resolve([]);
      }
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return resolve([]);
        const lines = data.trim().split('\n');
        resolve(lines.slice(-limit));
      });
    });
  }
}
