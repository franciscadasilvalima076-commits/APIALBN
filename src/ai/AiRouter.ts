import { GeminiClient } from '../core/apis/gemini/GeminiClient';
import { GroqClient } from '../core/apis/groq/GroqClient';
import { OpenRouterClient } from '../core/apis/openrouter/OpenRouterClient';
import { Logger } from '../automation/logger';

export interface AIAnalysisReport {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  regime: 'BULL_TREND' | 'BEAR_TREND' | 'MEAN_REVERSION_RANGE' | 'HIGH_VOLATILITY_CHOP';
  riskScore: number;
  explanation: string;
  source: 'GEMINI' | 'GROQ' | 'OPENROUTER' | 'LOCAL_FALLBACK';
  executionSpeedMs: number;
}

export class AiRouter {
  private static instance: AiRouter;
  private gemini = GeminiClient.getInstance();
  private groq = GroqClient.getInstance();
  private openRouter = OpenRouterClient.getInstance();
  private logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): AiRouter {
    if (!AiRouter.instance) {
      AiRouter.instance = new AiRouter();
    }
    return AiRouter.instance;
  }

  /**
   * Router entry point that coordinates models.
   * By default, it uses Gemini for high-level technical analysis and regime checks.
   * If Gemini fails, it routes to OpenRouter.
   * Simultaneously, it pulls Groq for a sub-millisecond second opinion to validate the decision.
   */
  public async routeAndAnalyze(
    symbol: string,
    currentPrice: number,
    change24h: number,
    technicalSummary: string
  ): Promise<AIAnalysisReport> {
    const startTime = Date.now();
    let regime: AIAnalysisReport['regime'] = 'MEAN_REVERSION_RANGE';
    let riskScore = 5;
    let explanation = '';
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let source: AIAnalysisReport['source'] = 'GEMINI';

    // 1. Core routing loop for Primary Regime Analysis (Gemini -> OpenRouter -> Fallback)
    try {
      this.logger.system('AI_ROUTER', `Primary routing: Directing ${symbol} to Gemini...`, 'INFO');
      const analysis = await this.gemini.analyzeMarketRegime(symbol, currentPrice, change24h, technicalSummary);
      
      regime = analysis.regime;
      riskScore = analysis.aiRiskScore;
      explanation = analysis.explanation;
      action = analysis.strategicAction;
      source = 'GEMINI';
    } catch (err: any) {
      this.logger.system('AI_ROUTER', `Gemini primary channel failed: ${err.message}. Routing fallback to OpenRouter...`, 'WARN');
      
      try {
        const altText = await this.openRouter.getAlternativeAnalysis(
          symbol,
          `Price: ${currentPrice}, 24h: ${change24h}%, Indicators: ${technicalSummary}`
        );
        
        regime = change24h > 3.0 ? 'BULL_TREND' : change24h < -3.0 ? 'BEAR_TREND' : 'MEAN_REVERSION_RANGE';
        riskScore = 6;
        explanation = `[OpenRouter Fallback] ${altText}`;
        action = altText.toUpperCase().includes('BUY') ? 'BUY' : altText.toUpperCase().includes('SELL') ? 'SELL' : 'HOLD';
        source = 'OPENROUTER';
      } catch (orErr: any) {
        this.logger.system('AI_ROUTER', `All remote AI networks offline: ${orErr.message}. Localized heuristics activated.`, 'ERROR');
        
        regime = change24h > 2.5 ? 'BULL_TREND' : change24h < -2.5 ? 'BEAR_TREND' : 'MEAN_REVERSION_RANGE';
        riskScore = 5;
        explanation = '[LOCAL HEURISTICS] Both cloud AI clusters timed out. Locally computed risk levels.';
        action = change24h > 1.5 ? 'BUY' : change24h < -1.5 ? 'SELL' : 'HOLD';
        source = 'LOCAL_FALLBACK';
      }
    }

    // 2. Ultra-rapid validation opinion via Groq (Ensemble Check)
    let consensusConfidence = 0.8;
    if (action !== 'HOLD') {
      try {
        const groqOpinion = await this.groq.getSecondOpinion(
          symbol,
          action,
          `Price: ${currentPrice}, Technicals: ${technicalSummary}`
        );
        
        if (!groqOpinion.agrees) {
          // If Groq disagrees, scale back our confidence and log warnings
          consensusConfidence = 0.45;
          explanation += ` | [Groq Conflict Warning]: Groq disagrees with action: "${groqOpinion.reason}"`;
          this.logger.system('AI_ROUTER', `Consensus conflict for ${symbol}: Groq issued veto risk opinion: ${groqOpinion.reason}`, 'WARN');
        } else {
          consensusConfidence = Math.max(0.75, groqOpinion.confidence);
          explanation += ` | [Groq Validated]`;
        }
      } catch (groqErr) {
        // Groq failed silently, proceed with high-confidence fallback
      }
    }

    const executionSpeedMs = Date.now() - startTime;
    this.logger.system('AI_ROUTER', `Routing analysis completed in ${executionSpeedMs}ms via ${source}. Action: ${action}`, 'SUCCESS');

    return {
      symbol,
      action,
      confidence: consensusConfidence,
      regime,
      riskScore,
      explanation,
      source,
      executionSpeedMs,
    };
  }
}
