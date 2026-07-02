import { ApiClient } from '../ApiClient';

export class OpenRouterClient extends ApiClient {
  private static instance: OpenRouterClient;

  private constructor() {
    super({
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY!;
      rateLimitRequestsPerMin: 60,
    });
  }

  public static getInstance(): OpenRouterClient {
    if (!OpenRouterClient.instance) {
      OpenRouterClient.instance = new OpenRouterClient();
    }
    return OpenRouterClient.instance;
  }

  /**
   * Fetches an alternative analysis from OpenRouter to create an ensemble or serve as a fallback
   */
  public async getAlternativeAnalysis(
    symbol: string,
    indicatorSummary: string,
    model = 'meta-llama/llama-3.1-8b-instruct:free' // Free/low-cost model by default
  ): Promise<string> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenRouter API Key not configured.');
      }

      this.logger.system('OPENROUTER_API', `Fetching fallback analysis for ${symbol} using ${model}...`, 'INFO');

      const response = await this.request<any>('/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://ai.studio/build',
          'X-Title': 'Multi-Asset Trading Bot',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an advanced quantitative trader. Analyze the ticker metrics and write a 1-sentence strategic action.'
            },
            {
              role: 'user',
              content: `Symbol: ${symbol}, Indicators: ${indicatorSummary}`
            }
          ],
          temperature: 0.3,
          max_tokens: 100,
        }),
      });

      if (response && response.choices && response.choices[0]) {
        return response.choices[0].message.content?.trim() || 'No clear direction.';
      }
      throw new Error('Empty response from OpenRouter');
    } catch (err: any) {
      this.logger.system('OPENROUTER_API', `Request failed: ${err.message}. Returning default.`, 'WARN');
      return `OpenRouter fallback channel offline. Maintain current risk parameters.`;
    }
  }

  public override async checkHealth(): Promise<boolean> {
    try {
      await this.getAlternativeAnalysis('BTCUSDT', 'RSI is 50');
      return true;
    } catch {
      return false;
    }
  }
}
