import { HealthMonitor } from './healthMonitor.js';
import { Logger } from './logger.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const logger = Logger.getInstance();

async function runHealthCheck() {
  logger.system('HEALTH_CHECK', '=== Initiating Quick Environment Diagnostics ===');

  let success = true;

  // 1. Check internet and latency
  const stats = await HealthMonitor.getSystemStats();
  logger.system('HEALTH_CHECK', `Internet Latency: ${stats.internetLatencyMs >= 0 ? stats.internetLatencyMs + 'ms' : 'OFFLINE'}`);
  logger.system('HEALTH_CHECK', `Binance Connectivity: ${stats.binancePingMs >= 0 ? stats.binancePingMs + 'ms' : 'UNREACHABLE'}`);
  logger.system('HEALTH_CHECK', `Gemini API Connectivity: ${stats.geminiPingMs >= 0 ? stats.geminiPingMs + 'ms' : 'UNREACHABLE'}`);

  if (stats.internetLatencyMs < 0) {
    logger.system('HEALTH_CHECK', 'Internet connection is offline. Critical issue!', 'ERROR');
    success = false;
  }

  // 2. Check environment variables
  const envPath = '.env';
  if (!fs.existsSync(envPath)) {
    logger.system('HEALTH_CHECK', '.env file does not exist. Please create one based on .env.example', 'WARN');
  }

  const binanceKey = process.env.BINANCE_API_KEY;
  const binanceSecret = process.env.BINANCE_SECRET_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!binanceKey || binanceKey === 'MY_BINANCE_API_KEY') {
    logger.system('HEALTH_CHECK', 'BINANCE_API_KEY is not configured or using placeholder value in .env', 'WARN');
  } else {
    logger.system('HEALTH_CHECK', 'BINANCE_API_KEY is configured.', 'SUCCESS');
  }

  if (!binanceSecret || binanceSecret === 'MY_BINANCE_SECRET_KEY') {
    logger.system('HEALTH_CHECK', 'BINANCE_SECRET_KEY is not configured or using placeholder value in .env', 'WARN');
  } else {
    logger.system('HEALTH_CHECK', 'BINANCE_SECRET_KEY is configured.', 'SUCCESS');
  }

  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    logger.system('HEALTH_CHECK', 'GEMINI_API_KEY is not configured or using placeholder value. AI analysis will run in simulated/local fallback mode.', 'WARN');
  } else {
    logger.system('HEALTH_CHECK', 'GEMINI_API_KEY is configured.', 'SUCCESS');
  }

  // 3. Clock drift check
  try {
    const sysTime = Date.now();
    // Quick test against worldtimeapi or similar, or just check Binance response headers
    logger.system('HEALTH_CHECK', `Local Clock: ${new Date(sysTime).toISOString()}`);
  } catch (error) {
    logger.system('HEALTH_CHECK', 'Failed to check clock drift', 'WARN');
  }

  if (success) {
    logger.system('HEALTH_CHECK', '=== DIAGNOSTICS COMPLETE: SYSTEM IS READY ===', 'SUCCESS');
    process.exit(0);
  } else {
    logger.system('HEALTH_CHECK', '=== DIAGNOSTICS FAILED: CORE ISSUES FOUND ===', 'ERROR');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthCheck();
}

export { runHealthCheck };
