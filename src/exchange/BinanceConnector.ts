import { APIKeyConfig, MarketTicker, OrderBook, Order, OrderType, TimeInForce } from '../types/trading';
import { EventBus } from '../core/EventBus';

export class BinanceConnector {
  private static instance: BinanceConnector;
  private apiKeys: APIKeyConfig[] = [];
  private activeKeyId: string | null = null;
  private eventBus = EventBus.getInstance();
  
  // Simulated connection states
  private connectedStreams: Set<string> = new Set();
  private wsConnected = false;
  private reconnectAttempts = 0;
  private rateLimitWeight = 0;
  private rateLimitMax = 1200; // requests per minute

  // Real-time market symbols we are tracking
  private tickers: Map<string, MarketTicker> = new Map([
    ['BTCUSDT', { symbol: 'BTCUSDT', price: 92450.5, change24h: 3.25, volume24h: 2451000000, bid: 92448.0, ask: 92451.0, openInterest: 84000, fundingRate: 0.0001 }],
    ['ETHUSDT', { symbol: 'ETHUSDT', price: 3410.25, change24h: -1.42, volume24h: 985000000, bid: 3409.8, ask: 3410.5, openInterest: 42000, fundingRate: 0.00008 }],
    ['SOLUSDT', { symbol: 'SOLUSDT', price: 184.85, change24h: 12.84, volume24h: 620000000, bid: 184.75, ask: 184.95, openInterest: 19500, fundingRate: 0.00015 }],
    ['BNBUSDT', { symbol: 'BNBUSDT', price: 615.4, change24h: 0.85, volume24h: 145000000, bid: 615.2, ask: 615.6, openInterest: 8500, fundingRate: 0.00005 }],
  ]);

  private orderbooks: Map<string, OrderBook> = new Map();

  private constructor() {
    this.generateMockOrderbooks();
    // Reset rate limits every minute
    setInterval(() => {
      this.rateLimitWeight = Math.max(0, this.rateLimitWeight - 50);
    }, 2000);
  }

  public static getInstance(): BinanceConnector {
    if (!BinanceConnector.instance) {
      BinanceConnector.instance = new BinanceConnector();
    }
    return BinanceConnector.instance;
  }

  // --- API KEY CONFIGURATIONS ---
  public addAPIKey(config: APIKeyConfig): void {
    this.apiKeys.push(config);
    if (!this.activeKeyId) {
      this.activeKeyId = config.id;
    }
    this.eventBus.emit('system:log', {
      module: 'EXCHANGE_CONNECTOR',
      level: 'SUCCESS',
      message: `Registered Binance API configuration [${config.name}] for subaccount/account structure.`
    });
  }

  public getActiveKey(): APIKeyConfig | null {
    return this.apiKeys.find(k => k.id === this.activeKeyId) || null;
  }

  public getAPIKeys(): APIKeyConfig[] {
    return this.apiKeys;
  }

  public setActiveKey(id: string): void {
    this.activeKeyId = id;
    this.eventBus.emit('system:log', {
      module: 'EXCHANGE_CONNECTOR',
      level: 'INFO',
      message: `Active trading credential context switched to: ${this.getActiveKey()?.name || 'None'}`
    });
  }

  // --- WS STREAMS & DATA SINK ---
  public connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      this.wsConnected = true;
      this.reconnectAttempts = 0;
      this.eventBus.emit('system:log', {
        module: 'BINANCE_WS',
        level: 'SUCCESS',
        message: 'Successfully established high-frequency websocket connection to production.binance.feed'
      });
      resolve(true);
    });
  }

  public subscribeStream(stream: string): void {
    this.connectedStreams.add(stream);
    this.eventBus.emit('system:log', {
      module: 'BINANCE_WS',
      level: 'INFO',
      message: `Subscribed to WebSocket Stream: ${stream}`
    });
  }

  public unsubscribeStream(stream: string): void {
    this.connectedStreams.delete(stream);
    this.eventBus.emit('system:log', {
      module: 'BINANCE_WS',
      level: 'INFO',
      message: `Unsubscribed from Stream: ${stream}`
    });
  }

  public triggerHeartbeat(): void {
    if (!this.wsConnected) return;
    this.eventBus.emit('system:log', {
      module: 'BINANCE_WS',
      level: 'INFO',
      message: 'Heartbeat ping sent. Connection stable.'
    });
  }

  // --- RETRIES, RATE LIMITING & EXECUTION PROXIES ---
  public async executeAPIRequest<T>(action: () => Promise<T>, weight = 1): Promise<T> {
    // Check rate limit
    if (this.rateLimitWeight + weight > this.rateLimitMax) {
      this.eventBus.emit('risk:alert', {
        level: 'WARNING',
        message: 'Binance API rate limit threshhold reached. Injecting defensive cooldown period.'
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.rateLimitWeight += weight;

    // Retry engine with backoff
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        return await action();
      } catch (err) {
        attempts++;
        if (attempts === maxAttempts) throw err;
        const delay = Math.pow(2, attempts) * 500;
        this.eventBus.emit('system:log', {
          module: 'BINANCE_API',
          level: 'WARN',
          message: `API request failed. Attempting retry ${attempts}/${maxAttempts} in ${delay}ms`
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('API Request failed after max retries.');
  }

  // --- MARKET QUERIES ---
  public getTicker(symbol: string): MarketTicker | null {
    return this.tickers.get(symbol) || null;
  }

  public getTickers(): MarketTicker[] {
    return Array.from(this.tickers.values());
  }

  public updateTickerPrice(symbol: string, change: number): void {
    const tick = this.tickers.get(symbol);
    if (tick) {
      const oldPrice = tick.price;
      const newPrice = Number((oldPrice + change).toFixed(2));
      tick.price = newPrice;
      tick.bid = Number((newPrice - 1.5).toFixed(2));
      tick.ask = Number((newPrice + 1.5).toFixed(2));
      
      // Randomly update metrics
      if (tick.openInterest) tick.openInterest += Math.floor((Math.random() - 0.5) * 50);
      
      this.tickers.set(symbol, tick);

      this.eventBus.emit('market:tick', {
        symbol,
        price: newPrice,
        timestamp: Date.now()
      });

      this.updateOrderbookPrice(symbol, newPrice);
    }
  }

  public getOrderBook(symbol: string): OrderBook | null {
    return this.orderbooks.get(symbol) || null;
  }

  // --- ORDER ROUTER ENTRY ---
  public async createOrder(params: {
    symbol: string;
    type: OrderType;
    side: 'BUY' | 'SELL';
    price?: number;
    quantity: number;
    timeInForce?: TimeInForce;
    stopPrice?: number;
    icebergQty?: number;
  }): Promise<Order> {
    return this.executeAPIRequest(async () => {
      const activeKey = this.getActiveKey();
      if (!activeKey) {
        throw new Error('No API Key credential loaded. Set API keys first.');
      }

      // Safeguard check
      if (params.quantity <= 0) {
        throw new Error('Order quantity must be positive.');
      }

      const id = 'BIN-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      const order: Order = {
        id,
        symbol: params.symbol,
        type: params.type,
        side: params.side,
        price: params.price,
        quantity: params.quantity,
        executedQty: 0,
        status: 'PENDING',
        timestamp: Date.now(),
        timeInForce: params.timeInForce || 'GTC',
        clientOrderId: 'cl-' + id,
        icebergQty: params.icebergQty,
        stopPrice: params.stopPrice
      };

      this.eventBus.emit('order:created', order);
      this.eventBus.emit('system:log', {
        module: 'BINANCE_EXECUTION',
        level: 'SUCCESS',
        message: `Order Registered: ${order.side} ${order.quantity} ${order.symbol} @ ${order.price || 'MARKET'} [Type: ${order.type}]`
      });

      // Quick simulate match
      setTimeout(() => {
        const tick = this.getTicker(params.symbol);
        const fillPrice = order.price || tick?.price || 100;
        
        // Fully fill
        order.executedQty = order.quantity;
        order.status = 'FILLED';
        
        this.eventBus.emit('order:filled', order);
        this.eventBus.emit('system:log', {
          module: 'MATCHING_ENGINE',
          level: 'SUCCESS',
          message: `Order Completed: ${order.id} completely filled at execution price: ${fillPrice}`
        });
      }, 800);

      return order;
    }, 2);
  }

  // --- PRIVATE UTILS ---
  private generateMockOrderbooks(): void {
    this.tickers.forEach((ticker, symbol) => {
      const bids: any[] = [];
      const asks: any[] = [];
      const p = ticker.price;

      for (let i = 1; i <= 10; i++) {
        bids.push({
          price: Number((p - i * 0.5).toFixed(2)),
          quantity: Number((Math.random() * 4 + 0.1).toFixed(3)),
          total: 0
        });
        asks.push({
          price: Number((p + i * 0.5).toFixed(2)),
          quantity: Number((Math.random() * 4 + 0.1).toFixed(3)),
          total: 0
        });
      }

      // accum totals
      let bidAcc = 0;
      bids.forEach(b => {
        bidAcc += b.quantity;
        b.total = Number(bidAcc.toFixed(3));
      });
      let askAcc = 0;
      asks.forEach(a => {
        askAcc += a.quantity;
        a.total = Number(askAcc.toFixed(3));
      });

      this.orderbooks.set(symbol, {
        symbol,
        bids,
        asks,
        sequence: 1000
      });
    });
  }

  private updateOrderbookPrice(symbol: string, centerPrice: number): void {
    const ob = this.orderbooks.get(symbol);
    if (ob) {
      ob.sequence++;
      ob.bids.forEach((bid, idx) => {
        bid.price = Number((centerPrice - (idx + 1) * 0.5).toFixed(2));
        bid.quantity = Number((Math.random() * 5 + 0.05).toFixed(3));
      });
      ob.asks.forEach((ask, idx) => {
        ask.price = Number((centerPrice + (idx + 1) * 0.5).toFixed(2));
        ask.quantity = Number((Math.random() * 5 + 0.05).toFixed(3));
      });

      let bidAcc = 0;
      ob.bids.forEach(b => {
        bidAcc += b.quantity;
        b.total = Number(bidAcc.toFixed(3));
      });
      let askAcc = 0;
      ob.asks.forEach(a => {
        askAcc += a.quantity;
        a.total = Number(askAcc.toFixed(3));
      });

      this.eventBus.emit('orderbook:update', { symbol, sequence: ob.sequence });
    }
  }
}
