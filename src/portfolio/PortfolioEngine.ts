import { Position, AccountBalance, Order, MarginType, MarketType } from '../types/trading';
import { EventBus } from '../core/EventBus';
import { RiskEngine } from '../risk/RiskEngine';

export class PortfolioEngine {
  private static instance: PortfolioEngine;
  private eventBus = EventBus.getInstance();
  private riskEngine = RiskEngine.getInstance();

  private balances: Map<string, AccountBalance> = new Map([
    ['USDT', { asset: 'USDT', free: 88500.0, locked: 0 }],
    ['BTC', { asset: 'BTC', free: 0.125, locked: 0 }],
    ['ETH', { asset: 'ETH', free: 1.5, locked: 0 }],
    ['SOL', { asset: 'SOL', free: 8.0, locked: 0 }]
  ]);

  private positions: Map<string, Position> = new Map();

  private constructor() {
    this.registerEventListeners();
  }

  public static getInstance(): PortfolioEngine {
    if (!PortfolioEngine.instance) {
      PortfolioEngine.instance = new PortfolioEngine();
    }
    return PortfolioEngine.instance;
  }

  public syncState(balances: AccountBalance[], positions: Position[]): void {
    this.balances.clear();
    balances.forEach(b => this.balances.set(b.asset, b));

    this.positions.clear();
    positions.forEach(p => this.positions.set(p.symbol, p));
  }

  public getBalances(): AccountBalance[] {
    return Array.from(this.balances.values());
  }

  public getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  public getPortfolioValue(): number {
    let value = 0;
    // Base capital is USDT
    const usdtBal = this.balances.get('USDT');
    if (usdtBal) value += usdtBal.free + usdtBal.locked;

    // We can simulate crypto conversions
    const btcBal = this.balances.get('BTC');
    if (btcBal) value += (btcBal.free + btcBal.locked) * 92450.5;

    const ethBal = this.balances.get('ETH');
    if (ethBal) value += (ethBal.free + ethBal.locked) * 3410.25;

    // Add position unrealized PnLs
    this.positions.forEach(pos => {
      value += pos.unrealizedPnl;
    });

    return Number(value.toFixed(2));
  }

  // --- MUTATORS & EXECUTION MATCHERS ---
  public openPosition(params: {
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    price: number;
    leverage: number;
    marginType: MarginType;
  }): void {
    if (this.riskEngine.getLimits().killSwitchActive) {
      this.eventBus.emit('system:log', {
        module: 'PORTFOLIO_ENGINE',
        level: 'ERROR',
        message: `Execution rejected: Kill switch active.`
      });
      return;
    }

    const { symbol, side, quantity, price, leverage, marginType } = params;

    // Calculate margins
    const notional = quantity * price;
    const initialMarginRequired = notional / leverage;

    // Debit cash balance
    const usdtBal = this.balances.get('USDT');
    if (!usdtBal || usdtBal.free < initialMarginRequired) {
      this.eventBus.emit('system:log', {
        module: 'PORTFOLIO_ENGINE',
        level: 'ERROR',
        message: `Insufficient margin balance to establish position. Required: ${initialMarginRequired.toFixed(2)} USDT`
      });
      return;
    }

    usdtBal.free = Number((usdtBal.free - initialMarginRequired).toFixed(4));
    usdtBal.locked = Number((usdtBal.locked + initialMarginRequired).toFixed(4));

    // Calculate simulated liquidation price
    const marginRatio = 0.05; // 5% maintenance margin
    const sideMult = side === 'LONG' ? 1 : -1;
    // Liquidation Price = Price * (1 - 1/Leverage + MarginRatio) for LONG
    const liquidationPrice = price * (1 - (sideMult / leverage) + (sideMult * marginRatio));

    const position: Position = {
      symbol,
      side,
      quantity,
      entryPrice: price,
      markPrice: price,
      liquidationPrice: Number(liquidationPrice.toFixed(2)),
      margin: initialMarginRequired,
      marginType,
      leverage,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0
    };

    this.positions.set(symbol, position);
    this.eventBus.emit('position:update', position);
    
    this.eventBus.emit('system:log', {
      module: 'PORTFOLIO_ENGINE',
      level: 'SUCCESS',
      message: `Opened ${side} Position on ${symbol} @ ${price} (Leverage: ${leverage}x, Margin: ${initialMarginRequired.toFixed(2)} USDT)`
    });
  }

  public closePosition(symbol: string, currentPrice: number): void {
    const pos = this.positions.get(symbol);
    if (!pos) return;

    const notionalEntry = pos.quantity * pos.entryPrice;
    const notionalCurrent = pos.quantity * currentPrice;
    
    let profit = 0;
    if (pos.side === 'LONG') {
      profit = notionalCurrent - notionalEntry;
    } else {
      profit = notionalEntry - notionalCurrent;
    }

    // Release locked margin and add profit
    const usdtBal = this.balances.get('USDT');
    if (usdtBal) {
      usdtBal.locked = Math.max(0, Number((usdtBal.locked - pos.margin).toFixed(4)));
      usdtBal.free = Number((usdtBal.free + pos.margin + profit).toFixed(4));
    }

    this.positions.delete(symbol);
    this.riskEngine.registerRealizedPnL(profit);

    // Notify updates
    this.eventBus.emit('position:update', {
      symbol,
      side: 'FLAT',
      quantity: 0,
      entryPrice: 0,
      markPrice: currentPrice,
      liquidationPrice: 0,
      margin: 0,
      marginType: 'CROSS',
      leverage: 1,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0
    });

    this.eventBus.emit('system:log', {
      module: 'PORTFOLIO_ENGINE',
      level: profit >= 0 ? 'SUCCESS' : 'WARN',
      message: `Closed Position on ${symbol} @ ${currentPrice}. PnL: ${profit.toFixed(2)} USDT (${profit >= 0 ? 'PROFIT' : 'LOSS'})`
    });
  }

  public emergencyFlattenAll(): void {
    this.positions.forEach((pos) => {
      this.closePosition(pos.symbol, pos.markPrice);
    });
    this.eventBus.emit('system:log', {
      module: 'PORTFOLIO_ENGINE',
      level: 'SUCCESS',
      message: 'All active portfolio positions flattened to raw cash reserve.'
    });
  }

  // --- EVENT LISTENERS ---
  private registerEventListeners(): void {
    // Dynamic tick updater
    this.eventBus.on('market:tick', (payload) => {
      const pos = this.positions.get(payload.symbol);
      if (pos) {
        pos.markPrice = payload.price;
        const notionalEntry = pos.quantity * pos.entryPrice;
        const notionalCurrent = pos.quantity * payload.price;

        let profit = 0;
        if (pos.side === 'LONG') {
          profit = notionalCurrent - notionalEntry;
        } else {
          profit = notionalEntry - notionalCurrent;
        }

        pos.unrealizedPnl = Number(profit.toFixed(2));
        pos.unrealizedPnlPercent = Number(((profit / pos.margin) * 100).toFixed(2));

        // Check liquidation breach
        if ((pos.side === 'LONG' && payload.price <= pos.liquidationPrice) ||
            (pos.side === 'SHORT' && payload.price >= pos.liquidationPrice)) {
          this.eventBus.emit('risk:alert', {
            level: 'CRITICAL',
            message: `LIQUIDATION TRIGGER BREACHED for ${pos.symbol} @ ${payload.price}`
          });
          this.closePosition(pos.symbol, pos.liquidationPrice);
        } else {
          this.eventBus.emit('position:update', pos);
        }
      }
    });

    // Handle completed orders
    this.eventBus.on('order:filled', (order) => {
      // If no active position, open one. If active position, adjust or close it.
      const currentPos = this.positions.get(order.symbol);
      if (!currentPos) {
        this.openPosition({
          symbol: order.symbol,
          side: order.side === 'BUY' ? 'LONG' : 'SHORT',
          quantity: order.quantity,
          price: order.price || 100,
          leverage: 10, // Default 10x
          marginType: 'CROSS'
        });
      } else {
        // Adjusting positions (e.g., matching sell on active long closes it)
        if ((currentPos.side === 'LONG' && order.side === 'SELL') ||
            (currentPos.side === 'SHORT' && order.side === 'BUY')) {
          this.closePosition(order.symbol, order.price || currentPos.markPrice);
        }
      }
    });
  }
}
