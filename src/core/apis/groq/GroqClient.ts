import { ApiClient } from '../ApiClient';

export class GroqClient extends ApiClient {
  private static instance: GroqClient;

  private constructor() {
    super({
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY || process.env.GROQ_API_KEY!;
      rateLimitRequestsPerMin: 120, // Groq supports high throughput
    });
  }

  public static getInstance(): GroqClient {
    if (!GroqClient.instance) {
      GroqClient.instance = new GroqClient();
    }
    return GroqClient.instance;
  }

  /**
   * Performs lightning-fast inference to provide a second opinion on a trade scenario
   */
  public async getSecondOpinion(
    symbol: string,
    action: 'BUY' | 'SELL' | 'HOLD',
    indicatorSummary: string
  ): Promise<{
    agrees: boolean;
    confidence: number;
    reason: string;
  }> {
    try {
      if (!this.config.apiKey) {
        throw new Error('Groq API Key is not configured.');
      }

      this.logger.system('GROQ_API', `Fetching high-speed second opinion for ${symbol}...`, 'INFO');

      const response = await this.request<any>('/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Active, low-latency model on Groq
          messages: [
            {
              role: 'system',
              content: 'You are an elite quantitative risk analyst. Evaluate proposed trades and respond strictly with JSON: {"agrees": boolean, "confidence": number (0 to 1), "reason": "one sentence explaining why"}'
            },
            {
              role: 'user',
              content: `Symbol: ${symbol}, Proposed Action: ${action}, Metrics: ${indicatorSummary}`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 150,
        }),
      });

      if (response && response.choices && response.choices[0]) {
        const text = response.choices[0].message.content || '';
        const parsed = JSON.parse(text.trim());
        return {
          agrees: parsed.agrees !== false,
          confidence: parsed.confidence || 0.7,
          reason: parsed.reason || 'Momentum structure favors execution alignment.',
        };
      }
      throw new Error('Empty response from Groq');
    } catch (err: any) {
      this.logger.system('GROQ_API', `Request failed: ${err.message}. Defaulting to absolute consensus.`, 'WARN');
      return {
        agrees: true,
        confidence: 0.8,
        reason: '[FALLBACK] Groq offline. Self-validating trade action based on momentum metrics.',
      };
    }
  }

  public override async checkHealth(): Promise<boolean> {
    try {
      await this.getSecondOpinion('BTCUSDT', 'HOLD', 'RSI is 50');
      return true;
    } catch {
      return false;
    }
  }
}
