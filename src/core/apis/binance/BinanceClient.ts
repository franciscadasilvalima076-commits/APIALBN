import { ApiClient } from '../ApiClient';

export interface BinanceSpotPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minQty: number;
  maxQty: number;
  tickSize: number;
  stepSize: number;
}

export interface MarketMetrics {
  symbol: string;
  price: number;
  volume24h: number;
  quoteVolume24h: number;
  spread: number;
  priceChangePercent: number;
  isEligible: boolean;
  score: number;
  indicators: {
    rsi: number;
    macd: { macd: number; signal: number; hist: number };
    atr: number;
    emaShort: number;
    emaLong: number;
  };
}

export class BinanceClient extends ApiClient {
  private static instance: BinanceClient;
  private spotPairs: BinanceSpotPair[] = [];

  private constructor() {
    super({
      name: 'BinanceSpot',
      baseUrl: 'https://api.binance.com/api/v3',
      rateLimitRequestsPerMin: 180, // High-frequency limit allowed
    });

    // Populate initial fallback/static catalog with approximate step sizes
    const staticCatalog = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT', 'TRXUSDT', 'DOTUSDT', 'LTCUSDT', 'ATOMUSDT', 'APTUSDT', 'NEARUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT', 'FETUSDT', 'PEPEUSDT', 'SHIBUSDT'];
    this.spotPairs = staticCatalog.map(sym => ({
      symbol: sym,
      baseAsset: sym.replace('USDT', ''),
      quoteAsset: 'USDT',
      status: 'TRADING',
      minQty: sym === 'BTCUSDT' ? 0.00001 : sym === 'ETHUSDT' ? 0.0001 : 0.01,
      maxQty: 100000,
      tickSize: 0.01,
      stepSize: sym === 'BTCUSDT' ? 0.00001 : sym === 'ETHUSDT' ? 0.0001 : (sym === 'DOGEUSDT' || sym === 'SHIBUSDT' || sym === 'PEPEUSDT' ? 1.0 : 0.01),
    }));
  }

  public static getInstance(): BinanceClient {
    if (!BinanceClient.instance) {
      BinanceClient.instance = new BinanceClient();
    }
    return BinanceClient.instance;
  }

  public getSpotPairs(): BinanceSpotPair[] {
    return this.spotPairs;
  }

  /**
   * Helper to format order quantities according to LOT_SIZE stepSize rules
   */
  public formatQuantity(symbol: string, quantity: number): number {
    const pair = this.spotPairs.find(p => p.symbol === symbol);
    const stepSize = pair ? pair.stepSize : 0.001; // default fallback
    
    const stepSizeStr = stepSize.toString();
    const decimalIndex = stepSizeStr.indexOf('.');
    const decimals = decimalIndex === -1 ? 0 : stepSizeStr.length - decimalIndex - 1;
    
    const factor = Math.floor(quantity / stepSize);
    return parseFloat((factor * stepSize).toFixed(decimals));
  }

  /**
   * Helper to format order prices according to PRICE_FILTER tickSize rules
   */
  public formatPrice(symbol: string, price: number): number {
    const pair = this.spotPairs.find(p => p.symbol === symbol);
    const tickSize = pair ? pair.tickSize : 0.01; // default fallback
    
    const tickSizeStr = tickSize.toString();
    const decimalIndex = tickSizeStr.indexOf('.');
    const decimals = decimalIndex === -1 ? 0 : tickSizeStr.length - decimalIndex - 1;
    
    const factor = Math.round(price / tickSize);
    return parseFloat((factor * tickSize).toFixed(decimals));
  }

  /**
   * Discovers and parses all Spot pairs available on Binance exchangeInfo
   */
  public async fetchAvailableSpotPairs(): Promise<BinanceSpotPair[]> {
    try {
      this.logger.system('BINANCE_API', 'Fetching real-time exchangeInfo from Binance Spot API...', 'INFO');
      const res = await this.request<any>('/exchangeInfo', { method: 'GET' }, 10 * 60 * 1000); // 10m Cache

      if (res && res.symbols) {
        const spotPairs = res.symbols
          .filter((sym: any) => sym.status === 'TRADING' && sym.quoteAsset === 'USDT' && sym.isSpotTradingAllowed)
          .map((sym: any) => {
            const lotSizeFilter = sym.filters.find((f: any) => f.filterType === 'LOT_SIZE');
            const priceFilter = sym.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
            return {
              symbol: sym.symbol,
              baseAsset: sym.baseAsset,
              quoteAsset: sym.quoteAsset,
              status: sym.status,
              minQty: lotSizeFilter ? parseFloat(lotSizeFilter.minQty) : 0.00001,
              maxQty: lotSizeFilter ? parseFloat(lotSizeFilter.maxQty) : 100000,
              tickSize: priceFilter ? parseFloat(priceFilter.tickSize) : 0.01,
              stepSize: lotSizeFilter ? parseFloat(lotSizeFilter.stepSize) : 0.00001,
            };
          });
        this.logger.system('BINANCE_API', `Successfully scanned and mapped ${spotPairs.length} Spot USDT assets.`, 'SUCCESS');
        this.spotPairs = spotPairs; // Save cache
        return spotPairs;
      }
      throw new Error('Malformed Binance exchangeInfo payload');
    } catch (err: any) {
      this.logger.system('BINANCE_API', `Exchange API inaccessible: ${err.message}. Loading static robust USDS/USDT asset catalog.`, 'WARN');
      // Full list of eligible USDT Spot pairs with safer stepSize mappings
      const staticCatalog = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT', 'TRXUSDT', 'DOTUSDT', 'LTCUSDT', 'ATOMUSDT', 'APTUSDT', 'NEARUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT', 'FETUSDT', 'PEPEUSDT', 'SHIBUSDT'];
      const staticPairs = staticCatalog.map(sym => ({
        symbol: sym,
        baseAsset: sym.replace('USDT', ''),
        quoteAsset: 'USDT',
        status: 'TRADING',
        minQty: sym === 'BTCUSDT' ? 0.00001 : sym === 'ETHUSDT' ? 0.0001 : 0.01,
        maxQty: 100000,
        tickSize: 0.01,
        stepSize: sym === 'BTCUSDT' ? 0.00001 : sym === 'ETHUSDT' ? 0.0001 : (sym === 'DOGEUSDT' || sym === 'SHIBUSDT' || sym === 'PEPEUSDT' ? 1.0 : 0.01),
      }));
      this.spotPairs = staticPairs;
      return staticPairs;
    }
  }

  /**
   * Fetches 24-hour pricing, volume, and spread metrics for filters
   */
  public async fetch24hMetrics(symbols?: string[]): Promise<Map<string, { price: number; volume: number; quoteVolume: number; spread: number; changePercent: number }>> {
    const metricsMap = new Map<string, { price: number; volume: number; quoteVolume: number; spread: number; changePercent: number }>();
    try {
      this.logger.system('BINANCE_API', 'Scraping market statistics tickers...', 'INFO');
      
      const res = await this.request<any[]>('/ticker/24hr', { method: 'GET' }, 30000); // 30s cache

      if (Array.isArray(res)) {
        res.forEach((item: any) => {
          if (item.symbol.endsWith('USDT')) {
            const price = parseFloat(item.lastPrice);
            const volume = parseFloat(item.volume);
            const quoteVolume = parseFloat(item.quoteVolume);
            const bidPrice = parseFloat(item.bidPrice) || price * 0.9999;
            const askPrice = parseFloat(item.askPrice) || price * 1.0001;
            const spread = askPrice - bidPrice;
            const changePercent = parseFloat(item.priceChangePercent);

            metricsMap.set(item.symbol, {
              price,
              volume,
              quoteVolume,
              spread: (spread / price) * 100, // as percentage
              changePercent,
            });
          }
        });
      }
      return metricsMap;
    } catch {
      // Direct offline fallback generator for symbols
      const list = symbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT', 'TRXUSDT', 'DOTUSDT', 'LTCUSDT', 'ATOMUSDT', 'APTUSDT', 'NEARUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT', 'FETUSDT', 'PEPEUSDT', 'SHIBUSDT'];
      list.forEach(sym => {
        const seed = Math.random();
        metricsMap.set(sym, {
          price: sym === 'BTCUSDT' ? 92450.5 : sym === 'ETHUSDT' ? 3410.25 : sym === 'SOLUSDT' ? 184.85 : sym === 'BNBUSDT' ? 615.4 : 50 + seed * 100,
          volume: 1000 + seed * 50000,
          quoteVolume: 10000000 + seed * 90000000,
          spread: 0.01 + seed * 0.05, // spread percentage
          changePercent: parseFloat(((seed - 0.5) * 10).toFixed(2)),
        });
      });
      return metricsMap;
    }
  }

  public override async checkHealth(): Promise<boolean> {
    try {
      const res = await this.request<any>('/ping');
      return res !== null;
    } catch {
      return false;
    }
  }

  /**
   * Envia uma ordem real de Spot para a Binance (requer chaves de API com permissão de Trading habilitada)
   */
  public async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'LIMIT' | 'MARKET',
    quantity: number,
    price?: number
  ): Promise<any> {
    const apiKey = process.env.BINANCE_API_KEY || this.config.apiKey;
    const apiSecret = process.env.BINANCE_SECRET_KEY || this.config.apiSecret;

    if (!apiKey || !apiSecret) {
      throw new Error('Chaves de API da Binance ausentes. Configure BINANCE_API_KEY e BINANCE_SECRET_KEY no arquivo .env');
    }

    const formattedQty = this.formatQuantity(symbol, quantity);
    const timestamp = Date.now();
    const params: Record<string, string> = {
      symbol,
      side,
      type,
      quantity: formattedQty.toString(),
      timestamp: timestamp.toString(),
    };

    if (type === 'LIMIT') {
      if (!price) throw new Error('O preço limite é obrigatório para ordens LIMIT');
      const formattedPrice = this.formatPrice(symbol, price);
      params.price = formattedPrice.toString();
      params.timeInForce = 'GTC';
    }

    // Criar query string ordenada
    const queryString = Object.entries(params)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join('&');

    // Assinar a requisição usando HMAC SHA256 com a Secret Key
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const fullQueryString = `${queryString}&signature=${signature}`;

    this.logger.system('BINANCE_API', `Enviando ordem REAL para Binance: ${side} ${formattedQty} ${symbol} via ${type}`, 'INFO');

    return this.request<any>(`/order?${fullQueryString}`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Busca saldos reais da conta Spot na Binance
   */
  public async fetchBalances(): Promise<any> {
    const apiKey = process.env.BINANCE_API_KEY || this.config.apiKey;
    const apiSecret = process.env.BINANCE_SECRET_KEY || this.config.apiSecret;

    if (!apiKey || !apiSecret) {
      throw new Error('Chaves de API da Binance ausentes.');
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;

    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const fullQueryString = `${queryString}&signature=${signature}`;

    return this.request<any>(`/account?${fullQueryString}`, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });
  }
}
