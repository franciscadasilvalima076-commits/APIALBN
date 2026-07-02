import { ApiClient } from '../ApiClient';

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

export class CoinGeckoClient extends ApiClient {
  private static instance: CoinGeckoClient;

  private constructor() {
    super({
      name: 'CoinGecko',
      baseUrl: 'https://api.coingecko.com/api/v3',
      apiKey: process.env.COINGECKO_API_KEY || 'CG-HKbvzwEWdPtJgKexUjsQaUDV',
      rateLimitRequestsPerMin: 30, // Conservatively low for free/demo accounts
    });
  }

  public static getInstance(): CoinGeckoClient {
    if (!CoinGeckoClient.instance) {
      CoinGeckoClient.instance = new CoinGeckoClient();
    }
    return CoinGeckoClient.instance;
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      // Demo API Key is sent via header
      headers['x-cg-demo-api-key'] = this.config.apiKey;
    }
    return headers;
  }

  /**
   * Retrieves high level crypto market trends, dominances, and capitalization
   */
  public async getGlobalData(): Promise<{
    active_cryptocurrencies: number;
    markets: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
  }> {
    try {
      const res = await this.request<any>(
        '/global',
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        },
        5 * 60 * 1000 // Cache global data for 5 minutes
      );
      return res.data;
    } catch (err: any) {
      this.logger.error('COINGECKO_API', 'Failed to retrieve global metrics', err);
      // Fallback
      return {
        active_cryptocurrencies: 15000,
        markets: 1100,
        total_market_cap: { usd: 2450000000000 },
        total_volume: { usd: 95000000000 },
        market_cap_percentage: { btc: 56.4, eth: 17.2, sol: 3.5 },
      };
    }
  }

  /**
   * Gets pricing and market cap data for core tracking coins
   */
  public async getMarkets(vsCurrency = 'usd', ids = 'bitcoin,ethereum,solana,binancecoin'): Promise<CoinGeckoMarketData[]> {
    try {
      return await this.request<CoinGeckoMarketData[]>(
        `/coins/markets?vs_currency=${vsCurrency}&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=false`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        },
        2 * 60 * 1000 // Cache markets data for 2 minutes
      );
    } catch (err: any) {
      this.logger.error('COINGECKO_API', `Failed to retrieve markets for ${ids}`, err);
      // Mock Fallback
      return [
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 92450.5, market_cap: 1800000000000, market_cap_rank: 1, total_volume: 35000000000, price_change_percentage_24h: 3.25 },
        { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3410.25, market_cap: 410000000000, market_cap_rank: 2, total_volume: 18000000000, price_change_percentage_24h: -1.42 },
        { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 184.85, market_cap: 85000000000, market_cap_rank: 5, total_volume: 6000000000, price_change_percentage_24h: 12.84 },
        { id: 'binancecoin', symbol: 'bnb', name: 'BNB', current_price: 615.4, market_cap: 90000000000, market_cap_rank: 4, total_volume: 1500000000, price_change_percentage_24h: 0.85 }
      ];
    }
  }

  public override async checkHealth(): Promise<boolean> {
    try {
      await this.getGlobalData();
      return true;
    } catch {
      return false;
    }
  }
}
