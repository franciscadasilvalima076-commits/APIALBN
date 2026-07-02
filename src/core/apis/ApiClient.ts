import { Logger } from '../../automation/logger';

export interface ApiClientConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  timeoutMs?: number;
  maxRetries?: number;
  rateLimitRequestsPerMin?: number;
}

export class ApiClient {
  protected config: ApiClientConfig;
  protected logger = Logger.getInstance();
  private cache = new Map<string, { value: any; expiresAt: number }>();
  private requestLog: number[] = [];

  constructor(config: ApiClientConfig) {
    this.config = {
      timeoutMs: 10000,
      maxRetries: 3,
      rateLimitRequestsPerMin: 60,
      ...config,
    };
  }

  // Rate limiting checker (sliding window)
  private async checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestLog = this.requestLog.filter(t => t > oneMinuteAgo);

    const limit = this.config.rateLimitRequestsPerMin || 60;
    if (this.requestLog.length >= limit) {
      const waitTime = 60000 - (now - this.requestLog[0]);
      this.logger.system(
        'API_CLIENT',
        `Rate limit reached for [${this.config.name}]. Cooling down for ${Math.ceil(waitTime / 1000)}s...`,
        'WARN'
      );
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.requestLog.push(Date.now());
  }

  // Resilient fetch with retries, exponential backoff, and timeouts
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheTtlMs = 0
  ): Promise<T> {
    const cacheKey = `${options.method || 'GET'}:${endpoint}:${JSON.stringify(options.body || '')}`;

    // Read cache
    if (cacheTtlMs > 0 && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (cached.expiresAt > Date.now()) {
        return cached.value as T;
      }
      this.cache.delete(cacheKey);
    }

    await this.checkRateLimit();

    let attempt = 0;
    const maxRetries = this.config.maxRetries || 3;
    const timeoutMs = this.config.timeoutMs || 10000;

    while (attempt < maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const url = endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`;
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Write cache
        if (cacheTtlMs > 0) {
          this.cache.set(cacheKey, {
            value: data,
            expiresAt: Date.now() + cacheTtlMs,
          });
        }

        return data as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        attempt++;
        
        // Determine if error is a permanent status block (e.g. 400, 401, 403, 404, 451) to fail-fast and avoid slow useless retries
        const isPermanent = /HTTP error (400|401|403|404|451)/i.test(err.message || '');
        const isLastAttempt = attempt >= maxRetries || isPermanent;
        
        const backoffDelay = Math.pow(2, attempt) * 1000;
        this.logger.system(
          'API_CLIENT',
          `[${this.config.name}] Request failed (attempt ${attempt}/${maxRetries}): ${err.message || err}. ${
            isLastAttempt ? 'Failing.' : `Retrying in ${backoffDelay}ms...`
          }`,
          isLastAttempt ? 'ERROR' : 'WARN'
        );

        if (isLastAttempt) {
          throw err;
        }

        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw new Error(`[${this.config.name}] Request failed after maximum retries.`);
  }

  public async checkHealth(): Promise<boolean> {
    try {
      // Default ping check. Child classes can override.
      return true;
    } catch {
      return false;
    }
  }
}
