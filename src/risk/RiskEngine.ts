import { RiskLimits, Position, Order, AccountBalance } from '../types/trading';
import { EventBus } from '../core/EventBus';

export class RiskEngine {
  private static instance: RiskEngine;
  private eventBus = EventBus.getInstance();

  private limits: RiskLimits = {
    maxPositionSizeATR: 2.0, // ATR multiplier max
    kellyFraction: 0.25, // Quarter Kelly for safety
    valueAtRisk95: 15000, // $15k maximum 95% 1-day VaR
    expectedShortfall95: 22000, // $22k max average loss beyond VaR
    dailyLossLimit: 5000, // Max daily loss $5,000 before circuit breaker
    maxDrawdownLimit: 12.0, // 12% Max absolute portfolio drawdown limit
    circuitBreakerActive: false,
    killSwitchActive: false,
    correlationLimit: 0.75
  };

  private dailyLossAccumulated = 0;
  private currentDrawdown = 0;
  private initialCapital = 100000;

  private constructor() {}

  public static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine();
    }
    return RiskEngine.instance;
  }

  public getLimits(): RiskLimits {
    return this.limits;
  }

  public updateLimits(newLimits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
    this.eventBus.emit('system:log', {
      module: 'RISK_ENGINE',
      level: 'INFO',
      message: 'Portfolio risk thresholds updated in active memory memory-pool.'
    });
  }

  public setLimits(limits: RiskLimits): void {
    this.limits = limits;
  }

  // --- COGNITIVE RISK ALGORITHMS ---
  
  /**
   * Calculate Kelly Criterion position fraction based on win probability and reward-to-risk ratio.
   */
  public calculateKellyFraction(winRate: number, rewardRiskRatio: number): number {
    if (rewardRiskRatio <= 0 || winRate <= 0) return 0;
    
    // f* = p - (1-p)/b = winRate - (1 - winRate) / rewardRiskRatio
    const kelly = winRate - (1 - winRate) / rewardRiskRatio;
    const safeKelly = kelly * this.limits.kellyFraction; // Scale Kelly to defend capital
    
    return Math.max(0, Number(safeKelly.toFixed(4)));
  }

  /**
   * ATR-based position size calculation.
   */
  public calculateATRSize(capital: number, entryPrice: number, atr: number, riskPercent: number): number {
    if (atr <= 0 || entryPrice <= 0) return 0;
    
    // Risk amount in USD
    const usdRisk = capital * (riskPercent / 100);
    // Position size based on 1 ATR stop loss distance
    const stopDistance = atr * 1.5; // Use 1.5 ATR as stop standard
    const qty = usdRisk / stopDistance;
    
    return Number(qty.toFixed(4));
  }

  /**
   * Evaluate Value at Risk & Expected Shortfall of positions
   */
  public evaluatePortfolioVaR(positions: Position[], balances: AccountBalance[]): { var95: number; es95: number } {
    let totalPortfolioValue = balances.reduce((sum, b) => sum + (b.free + (b.locked || 0)), 0);
    
    // Simplified parametric Value-at-Risk based on position exposure and average asset volatility (e.g. 3.5%)
    let activeExposure = positions.reduce((sum, p) => sum + (p.quantity * p.entryPrice), 0);
    
    if (activeExposure === 0) return { var95: 0, es95: 0 };

    // Standard 95% confidence level multiplier is 1.645
    const dailyVolatility = 0.038; // assumed avg portfolio crypto volatility
    const var95 = activeExposure * dailyVolatility * 1.645;
    
    // Expected Shortfall (CVaR) - average loss in worst 5% cases
    const es95 = var95 * 1.35;

    return {
      var95: Number(var95.toFixed(2)),
      es95: Number(es95.toFixed(2))
    };
  }

  // --- ACTIVE SAFEGUARD SENTINELS (CIRCUIT BREAKER & KILL SWITCH) ---

  public evaluateRiskSentry(balances: AccountBalance[], positions: Position[]): boolean {
    if (this.limits.killSwitchActive) {
      return false;
    }

    // Check Drawdown limits
    const currentEquity = balances.reduce((sum, b) => sum + (b.free + (b.locked || 0)), 0);
    const drawdownPercent = ((this.initialCapital - currentEquity) / this.initialCapital) * 100;
    this.currentDrawdown = Math.max(0, drawdownPercent);

    if (drawdownPercent >= this.limits.maxDrawdownLimit) {
      this.triggerEmergencyKill('MAX_DRAWDOWN_LIMIT_VIOLATION');
      return false;
    }

    // Check Daily loss limits
    if (this.dailyLossAccumulated >= this.limits.dailyLossLimit) {
      this.triggerCircuitBreaker('DAILY_LOSS_LIMIT_VIOLATION');
      return false;
    }

    return true;
  }

  public registerRealizedPnL(amount: number): void {
    if (amount < 0) {
      this.dailyLossAccumulated += Math.abs(amount);
      if (this.dailyLossAccumulated >= this.limits.dailyLossLimit) {
        this.triggerCircuitBreaker('DAILY_LOSS_LIMIT_VIOLATION');
      }
    }
  }

  public resetDailyAccumulator(): void {
    this.dailyLossAccumulated = 0;
    this.limits.circuitBreakerActive = false;
    this.eventBus.emit('system:log', {
      module: 'RISK_ENGINE',
      level: 'SUCCESS',
      message: 'Daily loss accumulator reset. Risk Circuit Breakers armed.'
    });
  }

  public triggerEmergencyKill(reason: string): void {
    this.limits.killSwitchActive = true;
    this.eventBus.emit('risk:alert', {
      level: 'KILL_SWITCH',
      message: `CRITICAL PORTFOLIO BREACH: [${reason}]. EXECUTING KILL SWITCH. FLATTENING ALL POSITIONS.`
    });
    this.eventBus.emit('system:log', {
      module: 'RISK_ENGINE',
      level: 'ERROR',
      message: `Kill switch active: ${reason}. Emergency orders sent.`
    });
  }

  public triggerCircuitBreaker(reason: string): void {
    this.limits.circuitBreakerActive = true;
    this.eventBus.emit('risk:alert', {
      level: 'CRITICAL',
      message: `PORTFOLIO ALERT: [${reason}]. Daily trading activities frozen. Armed Circuit Breaker.`
    });
  }
}
