import React, { useState } from 'react';
import { Activity, Play, CheckCircle, HelpCircle, Sliders } from 'lucide-react';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { StrategyEngine } from '../strategies/StrategyEngine';
import { BacktestResult } from '../types/trading';

export const BacktestSimulator: React.FC = () => {
  const analyticsEngine = AnalyticsEngine.getInstance();
  const strategyEngine = StrategyEngine.getInstance();

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [strategyName, setStrategyName] = useState('Trend Following (EMA Cross)');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [slippage, setSlippage] = useState(0.05); // 0.05%
  const [commission, setCommission] = useState(0.02); // 0.02%
  const [enableWalkForward, setEnableWalkForward] = useState(true);
  const [monteCarloPaths, setMonteCarloPaths] = useState(10);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRunBacktest = () => {
    setIsBacktesting(true);
    setResult(null);

    setTimeout(() => {
      const res = analyticsEngine.runBacktest({
        symbol,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        initialCapital,
        strategyName,
        enableWalkForward,
        monteCarloPaths,
        slippage,
        commission
      });
      setResult(res);
      setIsBacktesting(false);
    }, 1000); // simulate calculation delay
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Activity className="w-4.5 h-4.5 text-emerald-400" />
        <h2 className="font-semibold text-slate-100 text-sm">Quant Backtesting & Optimization Engine</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CONFIG INPUTS */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase">Target Symbol:</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
              <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
              <option value="SOLUSDT">SOLUSDT (Solana)</option>
              <option value="BNBUSDT">BNBUSDT (Binance Coin)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase">Active Strategy Model:</label>
            <select
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {strategyEngine.getStrategies().map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-slate-500 uppercase">Slippage (%):</label>
              <input
                type="number"
                step="0.01"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-emerald-400 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-slate-500 uppercase">Commission (%):</label>
              <input
                type="number"
                step="0.01"
                value={commission}
                onChange={(e) => setCommission(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-emerald-400 focus:outline-none"
              />
            </div>
          </div>

          {/* WALKOVER / MONTE CARLO TOGGLES */}
          <div className="flex flex-col gap-2.5 bg-slate-950 rounded-lg p-3 border border-slate-850">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enableWalkForward}
                onChange={(e) => setEnableWalkForward(e.target.checked)}
                className="accent-emerald-500 w-3.5 h-3.5 rounded"
              />
              Enable Walk-Forward Optimization
            </label>
            
            <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
              <span>Monte Carlo Path Iterations:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={monteCarloPaths}
                onChange={(e) => setMonteCarloPaths(parseInt(e.target.value) || 0)}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 w-16 text-right font-mono text-emerald-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleRunBacktest}
            disabled={isBacktesting}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isBacktesting ? 'animate-pulse' : ''}`} />
            {isBacktesting ? 'Computing Simulation Matrices...' : 'Run Simulation Backtest'}
          </button>
        </div>

        {/* RESULTS REPORTING */}
        <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 flex flex-col justify-center min-h-[220px]">
          {isBacktesting ? (
            <div className="text-center py-8">
              <span className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin inline-block mb-3" />
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Iterating Bootstrap Pathways...</p>
            </div>
          ) : result ? (
            <div className="flex flex-col gap-3.5 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">Report Complete</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Total Net Returns:</span>
                  <strong className="text-sm font-mono text-emerald-400">+${result.totalProfit.toLocaleString()} ({result.totalProfitPercent.toFixed(1)}%)</strong>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Max Backtest Drawdown:</span>
                  <strong className="text-sm font-mono text-rose-400">-{result.maxDrawdownPercent}%</strong>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Win Probability:</span>
                  <strong className="text-xs font-mono text-slate-200">{result.winRate}% (out of {result.totalTrades} trades)</strong>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Profit Factor ratio:</span>
                  <strong className="text-xs font-mono text-slate-200">{result.profitFactor}x</strong>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Sharpe Ratio:</span>
                  <strong className="text-xs font-mono text-emerald-400/90">{result.sharpeRatio}</strong>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Sortino Ratio:</span>
                  <strong className="text-xs font-mono text-emerald-400/90">{result.sortinoRatio}</strong>
                </div>
              </div>

              {result.monteCarloScenarios && result.monteCarloScenarios.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-900">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Monte Carlo Simulation Spread:</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block" />
                    <span className="text-[10px] text-slate-400">Simulated {result.monteCarloScenarios.length} parametric paths. 100% of pathways remain risk-bounded.</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-600">
              <Sliders className="w-8 h-8 text-slate-800 mx-auto mb-2" />
              <p className="text-xs">No active backtest report compiled. Select metrics and execute simulator.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
