export type MarketType = 'SPOT' | 'MARGIN' | 'FUTURES_USDM' | 'FUTURES_COINM';
export type MarginType = 'CROSS' | 'ISOLATED';

export interface APIKeyConfig {
  id: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  isSubaccount: boolean;
  subaccountName?: string;
  permissions: {
    spot: boolean;
    margin: boolean;
    futures: boolean;
    withdraw: boolean;
  };
}

export interface MarketTicker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  openInterest?: number;
  fundingRate?: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  sequence: number;
}

export type OrderType = 
  | 'MARKET' 
  | 'LIMIT' 
  | 'STOP' 
  | 'STOP_LIMIT' 
  | 'TAKE_PROFIT' 
  | 'TAKE_PROFIT_LIMIT' 
  | 'TRAILING_STOP' 
  | 'ICEBERG' 
  | 'OCO' 
  | 'BRACKET' 
  | 'TWAP' 
  | 'VWAP';

export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'POST_ONLY';

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: 'BUY' | 'SELL';
  price?: number;
  quantity: number;
  executedQty: number;
  status: 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED';
  timestamp: number;
  timeInForce?: TimeInForce;
  clientOrderId: string;
  reduceOnly?: boolean;
  postOnly?: boolean;
  icebergQty?: number;
  stopPrice?: number;
  trailingDelta?: number; // percentage
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT' | 'FLAT';
  quantity: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  margin: number;
  marginType: MarginType;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface AccountBalance {
  asset: string;
  free: number;
  locked: number;
  borrowed?: number; // margin
  interest?: number; // margin
}

export interface RiskLimits {
  maxPositionSizeATR: number;
  kellyFraction: number;
  valueAtRisk95: number;
  expectedShortfall95: number;
  dailyLossLimit: number;
  maxDrawdownLimit: number;
  circuitBreakerActive: boolean;
  killSwitchActive: boolean;
  correlationLimit: number;
}

export interface QuantitativeSignal {
  id: string;
  timestamp: number;
  symbol: string;
  strategyName: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0 to 1
  indicators: {
    rsi?: number;
    macd?: { macd: number; signal: number; hist: number };
    emaShort?: number;
    emaLong?: number;
    atr?: number;
    vwap?: number;
    orderFlowDelta?: number;
  };
}

export interface AIModelOpinion {
  modelName: string; // Gemini, Claude, OpenAI, DeepSeek, Grok, Mistral, Llama, Qwen
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  rationale: string;
}

export interface AIEnsembleReport {
  timestamp: number;
  symbol: string;
  ensembleAction: 'BUY' | 'SELL' | 'HOLD';
  compositeScore: number; // 0 to 100
  opinions: AIModelOpinion[];
  regimeDetected: 'BULL_TREND' | 'BEAR_TREND' | 'MEAN_REVERSION_RANGE' | 'HIGH_VOLATILITY_CHOP';
  aiRiskScore: number; // 1 to 10
  tradeExplanation: string;
}

export interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategyName: string;
  enableWalkForward: boolean;
  monteCarloPaths: number;
  slippage: number; // percentage
  commission: number; // percentage
}

export interface BacktestResult {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalProfit: number;
  totalProfitPercent: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  equityCurve: { date: string; equity: number }[];
  monteCarloScenarios?: { pathId: number; equityCurve: number[] }[];
}

export interface ExternalDataMetrics {
  fearAndGreedIndex: number;
  fundingRateAvg: number;
  openInterestTotal: number;
  whaleAlerts: { hash: string; symbol: string; amountUsd: number; from: string; to: string; time: string }[];
  economicEvents: { title: string; time: string; importance: 'HIGH' | 'MEDIUM' | 'LOW'; actual?: string; forecast?: string }[];
}
