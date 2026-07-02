import { QuantitativeSignal, MarketTicker } from '../types/trading';
import { EventBus } from '../core/EventBus';

export interface StrategyDefinition {
  name: string;
  type: string;
  isActive: boolean;
  parameters: { [key: string]: number };
  description: string;
}

export class StrategyEngine {
  private static instance: StrategyEngine;
  private eventBus = EventBus.getInstance();

  private strategies: Map<string, StrategyDefinition> = new Map([
    ['Trend Following (EMA Cross)', {
      name: 'Trend Following (EMA Cross)',
      type: 'MOMENTUM',
      isActive: true,
      parameters: { fastPeriod: 9, slowPeriod: 21, atrStopMult: 1.5 },
      description: 'Identifies directional trends using fast and slow exponential moving averages, entering on crossover with ATR trailing stops.'
    }],
    ['Smart Money Concepts (SMC)', {
      name: 'Smart Money Concepts (SMC)',
      type: 'ORDER_FLOW',
      isActive: true,
      parameters: { blockWindow: 50, mitigationFactor: 0.95 },
      description: 'Scans for market structure breaks (MSB), change of character (CHoCH), and unmitigated institutional order blocks.'
    }],
    ['Statistical Arbitrage (Pairs)', {
      name: 'Statistical Arbitrage (Pairs)',
      type: 'ARBITRAGE',
      isActive: false,
      parameters: { cointegrationThreshold: 0.98, zScoreEntry: 2.0 },
      description: 'Monitors co-integrated asset pairs, executing mean-reversion trades when price spreads deviate by specified standard deviations.'
    }],
    ['HFT Market Making', {
      name: 'HFT Market Making',
      type: 'LIQUIDITY',
      isActive: false,
      parameters: { spreadTicks: 2, orderRefreshMs: 500 },
      description: 'Supplies continuous bids and asks around the active orderbook spread, capturing delta flow margins.'
    }],
    ['ICT Liquidity Sweep', {
      name: 'ICT Liquidity Sweep',
      type: 'BREAKOUT',
      isActive: true,
      parameters: { swingPeriod: 20, deviationPct: 0.05 },
      description: 'Capitalizes on stop-runs and liquidity grabs above key swing highs or below swing lows, capturing sharp rejection tails.'
    }]
  ]);

  private constructor() {}

  public static getInstance(): StrategyEngine {
    if (!StrategyEngine.instance) {
      StrategyEngine.instance = new StrategyEngine();
    }
    return StrategyEngine.instance;
  }

  public getStrategies(): StrategyDefinition[] {
    return Array.from(this.strategies.values());
  }

  public toggleStrategy(name: string): void {
    const strat = this.strategies.get(name);
    if (strat) {
      strat.isActive = !strat.isActive;
      this.eventBus.emit('system:log', {
        module: 'STRATEGY_ENGINE',
        level: 'INFO',
        message: `Strategy [${name}] is now ${strat.isActive ? 'ENABLED' : 'DISABLED'}.`
      });
    }
  }

  public updateParameters(name: string, params: { [key: string]: number }): void {
    const strat = this.strategies.get(name);
    if (strat) {
      strat.parameters = { ...strat.parameters, ...params };
      this.eventBus.emit('system:log', {
        module: 'STRATEGY_ENGINE',
        level: 'SUCCESS',
        message: `Parameters tuned for ${name}.`
      });
    }
  }

  // --- AUTOMATED SIGNAL EVALUATOR ---
  public evaluateTickerSignals(ticker: MarketTicker): QuantitativeSignal | null {
    // Generate simulated trading signals based on strategy active states
    const activeStrats = Array.from(this.strategies.values()).filter(s => s.isActive);
    if (activeStrats.length === 0) return null;

    // Pick first active strategy
    const strat = activeStrats[0];

    // Generate smart random signal depending on ticker metrics
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0.5;

    const r = Math.random();
    if (strat.type === 'MOMENTUM') {
      if (ticker.change24h > 3.0 && r > 0.4) {
        action = 'BUY';
        confidence = 0.75 + (Math.random() * 0.15);
      } else if (ticker.change24h < -2.0 && r > 0.4) {
        action = 'SELL';
        confidence = 0.70 + (Math.random() * 0.2);
      }
    } else if (strat.type === 'ORDER_FLOW' || strat.type === 'LIQUIDITY') {
      if (r > 0.75) {
        action = r > 0.88 ? 'BUY' : 'SELL';
        confidence = 0.82;
      }
    } else if (strat.type === 'ARBITRAGE') {
      if (r > 0.8) {
        action = r > 0.9 ? 'BUY' : 'SELL';
        confidence = 0.68;
      }
    }

    if (action === 'HOLD') return null;

    // Simulate indicator calculations
    const rsi = Number((40 + Math.random() * 35).toFixed(1));
    const macdHist = Number(((Math.random() - 0.5) * 4).toFixed(2));
    const atr = Number((ticker.price * 0.02).toFixed(2));
    const vwap = Number((ticker.price * (1 + (Math.random() - 0.5) * 0.005)).toFixed(2));

    const signal: QuantitativeSignal = {
      id: 'SIG-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      timestamp: Date.now(),
      symbol: ticker.symbol,
      strategyName: strat.name,
      action,
      confidence,
      indicators: {
        rsi,
        macd: { macd: macdHist * 1.5, signal: macdHist * 1.1, hist: macdHist },
        emaShort: Number((ticker.price * 0.99).toFixed(2)),
        emaLong: Number((ticker.price * 1.01).toFixed(2)),
        atr,
        vwap,
        orderFlowDelta: Math.floor((Math.random() - 0.5) * 1500)
      }
    };

    this.eventBus.emit('signal:generated', signal);
    
    return signal;
  }
}
