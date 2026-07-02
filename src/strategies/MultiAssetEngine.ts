import { EventBus } from '../core/EventBus';
import { BinanceClient, BinanceSpotPair } from '../core/apis/binance/BinanceClient';
import { CoinGeckoClient } from '../core/apis/coingecko/CoinGeckoClient';
import { NewsApiClient } from '../core/apis/news/NewsApiClient';
import { RedditClient } from '../core/apis/reddit/RedditClient';
import { FredClient } from '../core/apis/fred/FredClient';
import { AiRouter } from '../ai/AiRouter';
import { TelegramClient } from '../core/apis/telegram/TelegramClient';
import { DiscordClient } from '../core/apis/discord/DiscordClient';
import { Position, AccountBalance } from '../types/trading';
import { StrategyEngine } from './StrategyEngine';

export interface AssetRanking {
  symbol: string;
  liquidityScore: number;
  trendScore: number;
  momentumScore: number;
  volatilityScore: number;
  riskScore: number;
  aiScore: number;
  sentimentScore: number;
  macroScore: number;
  orderFlowScore: number;
  institutionalScore: number;
  tradeConfidenceScore: number;
  totalScore: number;
  eligible: boolean;
  metrics: {
    price: number;
    volume24h: number;
    spread: number;
    change24h: number;
  };
}

export interface IsolatedBotState {
  symbol: string;
  status: 'ACTIVE' | 'IDLE' | 'PAUSED';
  side: 'LONG' | 'SHORT' | 'FLAT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  takeProfit: number;
  stopLoss: number;
  trailingStopActive: boolean;
  highestPriceReached: number;
  pnl: number;
  pnlPercent: number;
  indicators: {
    rsi: number;
    emaShort: number;
    emaLong: number;
    atr: number;
    vwap: number;
  };
  lastCycleTime: number;
}

export class MultiAssetEngine {
  private static instance: MultiAssetEngine;
  private eventBus = EventBus.getInstance();
  
  // Clients
  private binance = BinanceClient.getInstance();
  private coingecko = CoinGeckoClient.getInstance();
  private news = NewsApiClient.getInstance();
  private reddit = RedditClient.getInstance();
  private fred = FredClient.getInstance();
  private aiRouter = AiRouter.getInstance();
  private telegram = TelegramClient.getInstance();
  private discord = DiscordClient.getInstance();
  private strategyEngine = StrategyEngine.getInstance();

  // Engine States
  private rankings: AssetRanking[] = [];
  private bots: Map<string, IsolatedBotState> = new Map();
  private correlationMatrix: Record<string, Record<string, number>> = {};
  
  // Configs
  private maxPositions = 5;
  private totalCapital = 100000; // USD Portfolio size
  private freeCapital = 100000;
  private minVolumeUsdt = 5000000; // Lower to $5M Spot volume filter to allow more candidates
  private maxSpreadPct = 0.12; // 0.12% Spread filter
  private activeCycleInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeEngine();
  }

  public static getInstance(): MultiAssetEngine {
    if (!MultiAssetEngine.instance) {
      MultiAssetEngine.instance = new MultiAssetEngine();
    }
    return MultiAssetEngine.instance;
  }

  public getTotalCapital(): number {
    return this.totalCapital;
  }

  public setTotalCapital(capital: number) {
    const diff = capital - this.totalCapital;
    this.totalCapital = capital;
    this.freeCapital = Math.max(0, this.freeCapital + diff);
  }

  private async initializeEngine() {
    this.eventBus.emit('system:log', {
      module: 'MULTI_ASSET_ENGINE',
      level: 'INFO',
      message: 'Initializing Portfolio Manager and asset discovery loops...'
    });

    // Run first discovery cycle
    await this.runAssetDiscoveryAndScoringCycle();

    // Start cycle loop every 15 seconds to simulate high-frequency rebalancing
    this.activeCycleInterval = setInterval(() => {
      this.runAssetDiscoveryAndScoringCycle().catch(err => {
        this.loggerError(err);
      });
    }, 15000);
  }

  private isEngineRunning = true;

  public stopEngine() {
    this.isEngineRunning = false;
    if (this.activeCycleInterval) {
      clearInterval(this.activeCycleInterval);
      this.activeCycleInterval = null;
    }
    this.eventBus.emit('system:log', {
      module: 'MULTI_ASSET_ENGINE',
      level: 'WARN',
      message: 'Autonomous Portfolio Engine PAUSED by command control.'
    });
  }

  public startEngine() {
    if (this.isEngineRunning) return;
    this.isEngineRunning = true;
    this.initializeEngine();
  }

  public getEngineStatus(): 'ACTIVE' | 'PAUSED' {
    return this.isEngineRunning ? 'ACTIVE' : 'PAUSED';
  }

  private loggerError(err: any) {
    this.eventBus.emit('system:log', {
      module: 'MULTI_ASSET_ENGINE',
      level: 'ERROR',
      message: `Rebalancing loop exception: ${err.message || err}`
    });
  }

  /**
   * Primary loop of the multi-asset quantitative bot
   */
  public async runAssetDiscoveryAndScoringCycle() {
    this.eventBus.emit('system:log', {
      module: 'MULTI_ASSET_ENGINE',
      level: 'INFO',
      message: 'Starting automated asset discovery, scoring, and rebalancing cycle...'
    });

    try {
      // Synchronize real USDT balance if keys are set
      const apiKey = process.env.BINANCE_API_KEY;
      const apiSecret = process.env.BINANCE_SECRET_KEY;
      const isRealTrading = apiKey && apiSecret && !apiKey.includes('YOUR_') && apiKey.trim() !== '';

      if (isRealTrading) {
        try {
          const accountInfo = await this.binance.fetchBalances();
          if (accountInfo && accountInfo.balances) {
            const usdt = accountInfo.balances.find((b: any) => b.asset === 'USDT');
            if (usdt) {
              const balanceVal = parseFloat(usdt.free);
              this.totalCapital = balanceVal;
              
              let allocatedInActiveBots = 0;
              for (const [sym, activeBot] of this.bots.entries()) {
                if (activeBot.side !== 'FLAT') {
                  allocatedInActiveBots += activeBot.quantity * activeBot.currentPrice;
                }
              }
              this.freeCapital = Math.max(0, balanceVal - allocatedInActiveBots);
              
              this.eventBus.emit('system:log', {
                module: 'MULTI_ASSET_ENGINE',
                level: 'SUCCESS',
                message: `Real USDT Balance synced: ${balanceVal.toFixed(4)} USDT. Available: ${this.freeCapital.toFixed(4)} USDT.`
              });
            }
          }
        } catch (err: any) {
          this.eventBus.emit('system:log', {
            module: 'MULTI_ASSET_ENGINE',
            level: 'WARN',
            message: `Could not sync real balances: ${err.message}`
          });
        }
      }

      // 1. Fetch available spot pairs & 24h ticker metrics
      const pairs = await this.binance.fetchAvailableSpotPairs();
      const metrics = await this.binance.fetch24hMetrics(pairs.map(p => p.symbol));

      // 2. Load Macro conditions from FRED
      const macroSnapshot = await this.fred.getMacroSnapshot();
      const fundsRate = macroSnapshot.find(s => s.seriesId === 'FEDFUNDS')?.value || 5.25;
      const inflation = macroSnapshot.find(s => s.seriesId === 'CPIAUCSL')?.value || 3.1;
      const macroScore = fundsRate < 5.0 && inflation < 3.0 ? 85 : 45; // Liquidity expansion checks

      // 3. Load Sentiments from News and Reddit
      const latestNews = await this.news.getLatestCryptoNews();
      const newsAvgScore = latestNews.reduce((acc, n) => acc + n.score, 0) / (latestNews.length || 1);
      
      const redditTrends = await this.reddit.getCommunitySentiment();
      const redditScoreMap = new Map<string, number>();
      redditTrends.forEach(t => {
        const sentimentMultiplier = t.sentiment === 'BULLISH' ? 1.0 : t.sentiment === 'BEARISH' ? -1.0 : 0.0;
        redditScoreMap.set(t.topic.toLowerCase(), t.engagementScore * sentimentMultiplier);
      });

      // 4. Compute rankings and scores for each asset
      const newRankings: AssetRanking[] = [];

      for (const pair of pairs) {
        const m = metrics.get(pair.symbol);
        if (!m) continue;

        // Apply filters
        const volumeEligible = m.quoteVolume >= this.minVolumeUsdt;
        const spreadEligible = m.spread <= this.maxSpreadPct;
        const isEligible = volumeEligible && spreadEligible && pair.status === 'TRADING';

        // Quantitative Scores
        const liquidityScore = Math.min(100, Math.floor((m.quoteVolume / 150000000) * 100));
        const trendScore = m.changePercent > 0 ? Math.min(100, 50 + m.changePercent * 8) : Math.max(0, 50 + m.changePercent * 8);
        const momentumScore = Math.max(15, Math.min(95, 50 + m.changePercent * 4)); // Synthetic RSI proxy
        const volatilityScore = Math.min(100, Math.floor(Math.abs(m.changePercent) * 12));
        const riskScore = Math.max(10, Math.min(95, 100 - Math.floor(m.spread * 500)));

        // Pull dynamic AI Score only for top 10 assets to prevent token/latency limits
        let aiScore = 50;
        let aiOpinion: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let explanation = 'Analyzed via localized quantitative profiles.';

        if (isEligible && newRankings.length < 8) {
          try {
            const aiReport = await this.aiRouter.routeAndAnalyze(
              pair.symbol,
              m.price,
              m.changePercent,
              `RSI: ${momentumScore.toFixed(1)}, Spread: ${m.spread.toFixed(3)}%, 24h Vol: ${m.quoteVolume.toLocaleString()}`
            );
            aiOpinion = aiReport.action;
            aiScore = aiReport.action === 'BUY' ? 85 : aiReport.action === 'SELL' ? 20 : 50;
            explanation = aiReport.explanation;
          } catch {
            // silent fallback
          }
        }

        // Community sentiments
        const relativeNewsSentiment = Math.floor((newsAvgScore + 1) * 50);
        let communitySentimentScore = 55;
        redditTrends.forEach(t => {
          if (t.topic.toLowerCase().includes(pair.baseAsset.toLowerCase())) {
            communitySentimentScore = Math.floor((t.sentiment === 'BULLISH' ? 85 : t.sentiment === 'BEARISH' ? 25 : 50));
          }
        });
        const finalSentimentScore = Math.floor((relativeNewsSentiment + communitySentimentScore) / 2);

        // Confluência baseada nas estratégias de elite de SMC (fluxo de ordens institucional) e ICT (captura de liquidez)
        // SMC: Analisa blocos de ordens usando confluência de tendência de preço e volume de liquidez
        const smcValue = (trendScore * 0.45) + (liquidityScore * 0.35) + (m.changePercent > 0 ? 20 : 0);
        const orderFlowScore = Math.max(15, Math.min(99, Math.floor(smcValue)));

        // ICT: Analisa varreduras de liquidez focadas na volatilidade e score de risco
        const ictValue = (volatilityScore * 0.4) + (riskScore * 0.3) + (aiScore * 0.3);
        const institutionalScore = Math.max(15, Math.min(99, Math.floor(ictValue)));
        const tradeConfidenceScore = Math.floor((trendScore * 0.3) + (momentumScore * 0.2) + (aiScore * 0.3) + (finalSentimentScore * 0.2));

        const totalScore = Math.floor(
          (liquidityScore * 0.1) +
          (trendScore * 0.15) +
          (momentumScore * 0.1) +
          (volatilityScore * 0.05) +
          (riskScore * 0.05) +
          (aiScore * 0.15) +
          (finalSentimentScore * 0.1) +
          (macroScore * 0.1) +
          (orderFlowScore * 0.1) +
          (institutionalScore * 0.1)
        );

        newRankings.push({
          symbol: pair.symbol,
          liquidityScore,
          trendScore,
          momentumScore,
          volatilityScore,
          riskScore,
          aiScore,
          sentimentScore: finalSentimentScore,
          macroScore,
          orderFlowScore,
          institutionalScore,
          tradeConfidenceScore,
          eligible: isEligible,
          totalScore,
          metrics: {
            price: m.price,
            volume24h: m.quoteVolume,
            spread: m.spread,
            change24h: m.changePercent
          }
        });
      }

      // Sort by score
      this.rankings = newRankings.sort((a, b) => b.totalScore - a.totalScore);

      // Emit rankings update to system/front-end
      this.eventBus.emit('portfolio:rankings', this.rankings);

      // 5. Update Correlation Matrix
      this.updateCorrelationMatrix();

      // 6. Execute Rebalancing and Bot Cycle Updates
      await this.rebalanceBots();

    } catch (err: any) {
      this.loggerError(err);
    }
  }

  private updateCorrelationMatrix() {
    const topSymbols = this.rankings.filter(r => r.eligible).slice(0, 10).map(r => r.symbol);
    const matrix: Record<string, Record<string, number>> = {};

    topSymbols.forEach(s1 => {
      matrix[s1] = {};
      topSymbols.forEach(s2 => {
        if (s1 === s2) {
          matrix[s1][s2] = 1.0;
        } else {
          // Stable multi-asset correlation proxy (e.g. high correlations between majors, lower with alts)
          const isMajorPair = (s1.startsWith('BTC') || s1.startsWith('ETH') || s1.startsWith('SOL')) &&
                             (s2.startsWith('BTC') || s2.startsWith('ETH') || s2.startsWith('SOL'));
          matrix[s1][s2] = parseFloat((isMajorPair ? 0.75 + Math.random() * 0.15 : 0.3 + Math.random() * 0.4).toFixed(2));
        }
      });
    });

    this.correlationMatrix = matrix;
    this.eventBus.emit('portfolio:correlation', matrix);
  }

  /**
   * Dynamic rebalancing loop
   */
  private async rebalanceBots() {
    const eligibleTopRanked = this.rankings.filter(r => r.eligible).slice(0, this.maxPositions);
    const activeSymbols = eligibleTopRanked.map(r => r.symbol);

    // Close positions in bots that are no longer in the top eligible rankings (Inefficient assets)
    for (const [symbol, bot] of this.bots.entries()) {
      if (!activeSymbols.includes(symbol)) {
        if (bot.side !== 'FLAT') {
          this.eventBus.emit('system:log', {
            module: 'PORTFOLIO_REBALANCE',
            level: 'WARN',
            message: `Closing inefficient asset bot position on [${symbol}] to make room for higher score candidates.`
          });
          await this.closeBotPosition(symbol, 'REBALANCE');
        }
        this.bots.delete(symbol);
      }
    }

    // Allocate and update active asset bots
    for (const asset of eligibleTopRanked) {
      if (!this.bots.has(asset.symbol)) {
        this.bots.set(asset.symbol, {
          symbol: asset.symbol,
          status: 'ACTIVE',
          side: 'FLAT',
          quantity: 0,
          entryPrice: 0,
          currentPrice: asset.metrics.price,
          takeProfit: 0,
          stopLoss: 0,
          trailingStopActive: false,
          highestPriceReached: asset.metrics.price,
          pnl: 0,
          pnlPercent: 0,
          indicators: {
            rsi: asset.momentumScore,
            emaShort: asset.metrics.price * 0.995,
            emaLong: asset.metrics.price * 1.005,
            atr: asset.metrics.price * 0.015,
            vwap: asset.metrics.price * 0.998,
          },
          lastCycleTime: Date.now()
        });
      }

      await this.runIsolatedBotCycle(asset.symbol, asset);
    }

    // Emit live bot states update
    this.eventBus.emit('portfolio:bots', Array.from(this.bots.values()));
  }

  /**
   * Independent execution bot for each asset (Simulating multi-threading isolated loops)
   */
  private async runIsolatedBotCycle(symbol: string, rank: AssetRanking) {
    const bot = this.bots.get(symbol);
    if (!bot || bot.status !== 'ACTIVE') return;

    // Simulate price fluctuation
    const volatilitySeed = (Math.random() - 0.5) * (rank.volatilityScore / 30);
    bot.currentPrice = parseFloat((bot.currentPrice * (1 + volatilitySeed / 100)).toFixed(2));
    bot.lastCycleTime = Date.now();

    // 1. Dynamic Position tracking and Trailing Stop/TP/SL controls
    if (bot.side !== 'FLAT') {
      const entryPrice = bot.entryPrice;
      const price = bot.currentPrice;
      const sizeMult = bot.side === 'LONG' ? 1 : -1;

      bot.pnl = parseFloat(((price - entryPrice) * bot.quantity * sizeMult).toFixed(2));
      bot.pnlPercent = parseFloat((((price - entryPrice) / entryPrice) * 100 * sizeMult).toFixed(2));

      // Stop Loss / Take Profit / Trailing Stop verification
      const isStopLossTriggered = bot.side === 'LONG' ? price <= bot.stopLoss : price >= bot.stopLoss;
      const isTakeProfitTriggered = bot.side === 'LONG' ? price >= bot.takeProfit : price <= bot.takeProfit;

      // Trailing stop activation
      if (bot.side === 'LONG' && price > bot.highestPriceReached) {
        bot.highestPriceReached = price;
        // Adjust Trailing Stop higher
        const atrValue = bot.indicators.atr;
        bot.stopLoss = parseFloat((price - atrValue * 1.5).toFixed(2));
      }

      if (isStopLossTriggered) {
        await this.closeBotPosition(symbol, 'STOP_LOSS');
      } else if (isTakeProfitTriggered) {
        await this.closeBotPosition(symbol, 'TAKE_PROFIT');
      }
    } else {
      // 2. ENTRY DECISION ENGINE (Long/Short) based on Trend Confidence Score
      if (rank.totalScore >= 60 && rank.tradeConfidenceScore >= 60) {
        // Trigger BUY/LONG entry
        await this.openBotPosition(symbol, 'LONG', rank);
      } else if (rank.totalScore <= 44 && rank.tradeConfidenceScore <= 45) {
        // Trigger SELL/SHORT entry (for futures or spot hedge)
        await this.openBotPosition(symbol, 'SHORT', rank);
      }
    }
  }

  private async openBotPosition(symbol: string, side: 'LONG' | 'SHORT', rank: AssetRanking) {
    const bot = this.bots.get(symbol);
    if (!bot) return;

    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_SECRET_KEY;
    const isRealTrading = apiKey && apiSecret && !apiKey.includes('YOUR_') && apiKey.trim() !== '';

    // Capital allocation sizing: Kelly Criterion & Risk Parity
    const winRate = 0.58; // Hist. performance proxy
    const profitFactor = 1.6;
    const kellyFraction = winRate - (1 - winRate) / profitFactor; // Kelly formula
    const kellySizing = Math.max(0.01, Math.min(0.12, kellyFraction * 0.5)); // Half-Kelly risk limit

    // Volatility Targeting / Risk Parity
    const atrPct = (bot.indicators.atr / bot.currentPrice) * 100;
    const volatilityWeight = Math.max(0.2, Math.min(1.0, 1.5 / atrPct)); // Scale size down for high volatility

    const finalAllocPct = kellySizing * volatilityWeight;
    let allocCapital = this.totalCapital * finalAllocPct;

    if (isRealTrading) {
      // Aloca proporcionalmente ao capital total usando Kelly, mas garante o piso de segurança de 11 USDT para evitar erros da Binance
      allocCapital = Math.max(11.0, this.totalCapital * finalAllocPct);
    }

    let qty = allocCapital / bot.currentPrice;

    if (isRealTrading) {
      qty = this.binance.formatQuantity(symbol, qty);
      
      // Garante que o valor da transação atinja o patamar mínimo seguro de 10.5 USDT para evitar erros MIN_NOTIONAL na Binance
      const pair = this.binance.getSpotPairs()?.find(p => p.symbol === symbol);
      const stepSize = pair ? pair.stepSize : 0.001;
      
      let attempts = 0;
      while (qty * bot.currentPrice < 10.5 && attempts < 100) {
        qty = parseFloat((qty + stepSize).toFixed(10));
        attempts++;
      }
      qty = this.binance.formatQuantity(symbol, qty);
    } else {
      qty = parseFloat(qty.toFixed(4));
    }

    const requiredCapital = isRealTrading ? qty * bot.currentPrice : allocCapital;

    if (qty > 0 && this.freeCapital >= requiredCapital) {
      this.freeCapital -= requiredCapital;
      
      bot.side = side;
      bot.quantity = qty;
      bot.entryPrice = bot.currentPrice;
      bot.highestPriceReached = bot.currentPrice;
      
      const atrValue = bot.indicators.atr;
      
      if (side === 'LONG') {
        // Alvo estendido para maximizar lucros em tendências fortes (2.5x o ATR), com piso mínimo de 3.5%
        const tpValue = bot.currentPrice + (atrValue * 2.5);
        bot.takeProfit = parseFloat(Math.max(tpValue, bot.currentPrice * 1.035).toFixed(2));

        // Stop loss baseado em volatilidade (1.5x o ATR) para evitar ruídos, com teto de perda máxima de 3.5%
        const slValue = bot.currentPrice - (atrValue * 1.5);
        bot.stopLoss = parseFloat(Math.max(slValue, bot.currentPrice * 0.965).toFixed(2));
      } else {
        // SHORT (para cenários de hedge)
        const tpValue = bot.currentPrice - (atrValue * 2.5);
        bot.takeProfit = parseFloat(Math.min(tpValue, bot.currentPrice * 0.965).toFixed(2));

        const slValue = bot.currentPrice + (atrValue * 1.5);
        bot.stopLoss = parseFloat(Math.min(slValue, bot.currentPrice * 1.035).toFixed(2));
      }
      bot.trailingStopActive = true;

      if (isRealTrading && side === 'LONG') {
        this.eventBus.emit('system:log', {
          module: 'EXECUTION_ENGINE',
          level: 'INFO',
          message: `Iniciando envio de ordem REAL de Compra na Binance: BUY MARKET ${qty} ${symbol} (Aproximadamente $${requiredCapital.toFixed(2)} USDT)`
        });

        this.binance.placeOrder(symbol, 'BUY', 'MARKET', qty)
          .then((result) => {
            this.eventBus.emit('system:log', {
              module: 'EXECUTION_ENGINE',
              level: 'SUCCESS',
              message: `Ordem REAL executada com sucesso na Binance para ${symbol}. ID: ${result.orderId || 'N/A'}`
            });
          })
          .catch((err) => {
            this.eventBus.emit('system:log', {
              module: 'EXECUTION_ENGINE',
              level: 'ERROR',
              message: `Falha na ordem real na Binance para ${symbol}: ${err.message}. Continuando em modo SIMULADO.`
            });
            if (err.message.includes('451')) {
              this.eventBus.emit('system:log', {
                module: 'EXECUTION_ENGINE',
                level: 'WARN',
                message: `AVISO DE IP: A Binance bloqueou a requisição devido ao IP do servidor estar localizado nos EUA (HTTP 451). Execute o aplicativo localmente em seu PC para usar chaves de produção!`
              });
            }
          });
      }

      const justification = await this.aiRouter.routeAndAnalyze(
        symbol,
        bot.currentPrice,
        rank.metrics.change24h,
        `Kelly allocation: ${(finalAllocPct * 100).toFixed(1)}%, Alloc: $${allocCapital.toLocaleString()}`
      );

      const msg = `🚀 <b>Isolated Position Opened</b>\n` +
                  `Asset: <b>${symbol}</b>\n` +
                  `Side: <b>${side}</b>\n` +
                  `Qty: <b>${qty}</b>\n` +
                  `Price: <b>$${bot.currentPrice}</b>\n` +
                  `Allocated: <b>$${allocCapital.toFixed(2)}</b>\n` +
                  `Justification: <i>${justification.explanation}</i>`;

      // Trigger alerts
      this.telegram.sendNotification(msg);
      this.discord.sendAlert('Isolated Position Entry', `${symbol} entered ${side} @ $${bot.currentPrice}`, 'SUCCESS');

      this.eventBus.emit('system:log', {
        module: 'EXECUTION_ENGINE',
        level: 'SUCCESS',
        message: `Isolated Order Opened: ${side} ${qty} ${symbol} @ $${bot.currentPrice}`
      });
    }
  }

  private async closeBotPosition(symbol: string, reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'REBALANCE') {
    const bot = this.bots.get(symbol);
    if (!bot || bot.side === 'FLAT') return;

    const returnCapital = bot.quantity * bot.currentPrice;
    this.freeCapital = Math.min(this.totalCapital, this.freeCapital + returnCapital);

    // Envia ordem real de Venda na Binance se as chaves de API estiverem configuradas
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_SECRET_KEY;
    const isRealTrading = apiKey && apiSecret && !apiKey.includes('YOUR_') && apiKey.trim() !== '';

    if (isRealTrading && bot.side === 'LONG') {
      this.eventBus.emit('system:log', {
        module: 'EXECUTION_ENGINE',
        level: 'INFO',
        message: `Iniciando envio de ordem REAL de Venda (Fechamento) na Binance: SELL MARKET ${bot.quantity} ${symbol}`
      });

      this.binance.placeOrder(symbol, 'SELL', 'MARKET', bot.quantity)
        .then((result) => {
          this.eventBus.emit('system:log', {
            module: 'EXECUTION_ENGINE',
            level: 'SUCCESS',
            message: `Ordem REAL de Venda executada com sucesso na Binance para ${symbol}. ID: ${result.orderId || 'N/A'}`
          });
        })
        .catch((err) => {
          this.eventBus.emit('system:log', {
            module: 'EXECUTION_ENGINE',
            level: 'ERROR',
            message: `Falha na ordem real de Venda na Binance para ${symbol}: ${err.message}. Fechando localmente em modo SIMULADO.`
          });
        });
    }

    const msg = `⚠️ <b>Isolated Position Closed</b>\n` +
                `Asset: <b>${symbol}</b>\n` +
                `Reason: <b>${reason}</b>\n` +
                `Exit Price: <b>$${bot.currentPrice}</b>\n` +
                `PnL: <b>$${bot.pnl} (${bot.pnlPercent}%)</b>`;

    this.telegram.sendNotification(msg);
    this.discord.sendAlert('Isolated Position Exit', `${symbol} closed via ${reason}. PnL: $${bot.pnl} (${bot.pnlPercent}%)`, reason === 'TAKE_PROFIT' ? 'SUCCESS' : 'WARN');

    bot.side = 'FLAT';
    bot.quantity = 0;
    bot.entryPrice = 0;
    bot.pnl = 0;
    bot.pnlPercent = 0;

    this.eventBus.emit('system:log', {
      module: 'EXECUTION_ENGINE',
      level: 'SUCCESS',
      message: `Isolated Position Exit: Closed ${symbol} via ${reason} @ $${bot.currentPrice}`
    });
  }

  // Set limits
  public setMaxPositions(max: number) {
    this.maxPositions = max;
    this.eventBus.emit('system:log', {
      module: 'MULTI_ASSET_ENGINE',
      level: 'INFO',
      message: `Max simultaneous positions updated to: ${max}`
    });
  }

  public getRankings() {
    return this.rankings;
  }

  public getBots() {
    return Array.from(this.bots.values());
  }

  public getCorrelationMatrix() {
    return this.correlationMatrix;
  }

  public getPortfolioHeat() {
    const active = Array.from(this.bots.values()).filter(b => b.side !== 'FLAT').length;
    return (active / this.maxPositions) * 100;
  }
}
