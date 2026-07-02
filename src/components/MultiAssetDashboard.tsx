import React, { useState, useEffect } from 'react';
import { Cpu, ShieldAlert, Sliders, Layers, TrendingUp, CheckCircle2, XCircle, Info, RefreshCw, DollarSign, PiggyBank, Target, ArrowRight, Zap, Award } from 'lucide-react';
import { AssetRanking, IsolatedBotState } from '../strategies/MultiAssetEngine';

export function MultiAssetDashboard() {
  const [rankings, setRankings] = useState<AssetRanking[]>([]);
  const [bots, setBots] = useState<IsolatedBotState[]>([]);
  const [correlation, setCorrelation] = useState<Record<string, Record<string, number>>>({});
  const [portfolioHeat, setPortfolioHeat] = useState<number>(0);
  const [maxPositions, setMaxPositions] = useState<number>(5);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'RANKINGS' | 'BOTS' | 'CORRELATION'>('RANKINGS');

  // Titan target and deposit states
  const [balances, setBalances] = useState<any[]>([]);
  const [portfolioValue, setPortfolioValue] = useState<number>(100000);
  const [depositAmount, setDepositAmount] = useState<number>(500);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string>('');
  const [isDepositing, setIsDepositing] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      // Fetch rankings
      const rRes = await fetch('/api/portfolio/rankings');
      if (rRes.ok) {
        const data = await rRes.json();
        setRankings(data.rankings || []);
      }

      // Fetch active bots
      const bRes = await fetch('/api/portfolio/bots');
      if (bRes.ok) {
        const data = await bRes.json();
        setBots(data.bots || []);
      }

      // Fetch correlation matrix
      const cRes = await fetch('/api/portfolio/correlation');
      if (cRes.ok) {
        const data = await cRes.json();
        setCorrelation(data.correlationMatrix || {});
        setPortfolioHeat(data.portfolioHeat || 0);
      }

      // Fetch general status for balances and portfolio value
      const sRes = await fetch('/api/status');
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.tradingState) {
          setBalances(sData.tradingState.balances || []);
          
          // Calculate total portfolio value
          let value = 0;
          const usdt = sData.tradingState.balances.find((b: any) => b.asset === 'USDT');
          if (usdt) value += usdt.free + usdt.locked;
          
          const btc = sData.tradingState.balances.find((b: any) => b.asset === 'BTC');
          if (btc) value += (btc.free + btc.locked) * 65000;
          
          const eth = sData.tradingState.balances.find((b: any) => b.asset === 'ETH');
          if (eth) value += (eth.free + eth.locked) * 3450;
          
          const sol = sData.tradingState.balances.find((b: any) => b.asset === 'SOL');
          if (sol) value += (sol.free + sol.locked) * 145.2;

          setPortfolioValue(value);
        }
      }
    } catch (err) {
      // silent fail fallback
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;
    setIsDepositing(true);
    setDepositSuccessMsg('');
    try {
      const res = await fetch('/api/portfolio/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amountBrl: depositAmount }),
      });
      if (res.ok) {
        const data = await res.json();
        setDepositSuccessMsg(`Sucesso! Depósito de R$ ${depositAmount} (+ $${data.amountUsdt} USDT) creditado no Robô.`);
        fetchData();
        setTimeout(() => setDepositSuccessMsg(''), 6000);
      }
    } catch (err) {
      //
    } finally {
      setIsDepositing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMaxPositionsChange = async (val: number) => {
    setMaxPositions(val);
    setIsUpdating(true);
    try {
      const response = await fetch('/api/portfolio/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxPositions: val }),
      });
      if (response.ok) {
        setTimeout(() => setIsUpdating(false), 500);
      }
    } catch {
      setIsUpdating(false);
    }
  };

  const getHeatColor = (heat: number) => {
    if (heat >= 75) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (heat >= 40) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  const getCorrelationColor = (coef: number) => {
    if (coef >= 0.7) return 'bg-red-500/20 text-red-300 border-red-500/10';
    if (coef >= 0.4) return 'bg-amber-500/10 text-amber-300 border-amber-500/10';
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/10';
  };

  return (
    <section className="bg-slate-900 border border-slate-850 rounded-xl p-6 flex flex-col gap-6" id="multi_asset_dashboard_section">
      
      {/* SECTION HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-100 uppercase font-mono">
              Multi-Asset Autonomous Portfolio Engine
            </h2>
            <p className="text-xs text-slate-400">
              Scans all Spot markets, filters liquidity, scoring 12 core quant criteria with Kelly Criterion allocation
            </p>
          </div>
        </div>

        {/* INTERACTIVE CONTROLS */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 font-bold">MAX CONCURRENT BOTS:</span>
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {maxPositions}
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="20"
            value={maxPositions}
            onChange={(e) => handleMaxPositionsChange(Number(e.target.value))}
            className="accent-emerald-500 w-32 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
          {isUpdating && <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />}

          <div className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-mono border ${getHeatColor(portfolioHeat)}`}>
            <span>HEAT EXPOSURE:</span>
            <span className="font-extrabold">{portfolioHeat.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* TITAN AI LIVE TARGET WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 p-5 rounded-xl border border-emerald-500/10 shadow-inner relative overflow-hidden">
        {/* Background glow decorator */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        
        {/* Left Column: Target tracker progress */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-5 h-5 text-emerald-400 shrink-0" />
              <h3 className="text-xs font-bold font-mono tracking-wider text-emerald-400 uppercase">
                Painel de Metas do Robô Titan AI Quant
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Maximize seus lucros utilizando confluências avançadas de Smart Money Concepts (SMC/Order Blocks) e ICT (Liquidity Sweeps) ao vivo. O motor de execução calcula riscos em tempo real com dimensionamento por Critério de Kelly.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-end justify-between text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Saldo do Robô (Simulado)</span>
                <span className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                  ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  <span className="text-[11px] text-slate-400 ml-1.5 font-normal">
                    (R$ ${(portfolioValue * 5.60).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase">Alvo até Amanhã</span>
                <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  ${(portfolioValue < 1000 ? 1000 : portfolioValue < 150000 ? 150000 : 1000000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 relative">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000"
                style={{ 
                  width: `${Math.min(100, (portfolioValue / (portfolioValue < 1000 ? 1000 : portfolioValue < 150000 ? 150000 : 1000000)) * 100)}%` 
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Progresso: {Math.min(100, (portfolioValue / (portfolioValue < 1000 ? 1000 : portfolioValue < 150000 ? 150000 : 1000000)) * 100).toFixed(1)}%</span>
              <span className="flex items-center gap-1 text-emerald-400/90 font-bold">
                <Zap className="w-3 h-3 animate-bounce" /> Estratégia de Elite Ativa
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Capital Deposit Simulation */}
        <div className="lg:col-span-5 bg-slate-900/50 p-4 rounded-lg border border-slate-850 flex flex-col gap-3 justify-center">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200 font-mono">Injetar Novo Capital (BRL)</span>
          </div>

          <form onSubmit={handleDeposit} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 font-bold font-mono">R$</span>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="Ex: 500"
                  className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500 text-slate-100"
                />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600" />
              <div className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-emerald-400 font-bold">
                + ${(depositAmount / 5.60).toFixed(2)} USDT
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[100, 500, 1000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDepositAmount(val)}
                  className={`py-1 text-[10px] font-mono rounded border transition ${
                    depositAmount === val
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900 cursor-pointer'
                  }`}
                >
                  R$ {val.toLocaleString()}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isDepositing || depositAmount <= 0}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-2 px-3 rounded text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isDepositing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Processando Depósito...
                </>
              ) : (
                <>
                  <Award className="w-3.5 h-3.5" />
                  Injetar R$ {depositAmount.toLocaleString()} no Robô
                </>
              )}
            </button>
          </form>

          {depositSuccessMsg && (
            <div className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded p-2 text-center font-mono animate-fadeIn">
              {depositSuccessMsg}
            </div>
          )}
        </div>
      </div>

      {/* SUB TAB CONTROLLERS */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveSubTab('RANKINGS')}
          className={`px-4 py-2 text-xs font-bold font-mono transition-all border-b-2 ${
            activeSubTab === 'RANKINGS'
              ? 'border-emerald-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          id="subtab_rankings_btn"
        >
          DISCOVERY & SCORING MATRIX ({rankings.length})
        </button>
        <button
          onClick={() => setActiveSubTab('BOTS')}
          className={`px-4 py-2 text-xs font-bold font-mono transition-all border-b-2 ${
            activeSubTab === 'BOTS'
              ? 'border-emerald-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          id="subtab_bots_btn"
        >
          ISOLATED ASSET BOT CYCLES ({bots.length})
        </button>
        <button
          onClick={() => setActiveSubTab('CORRELATION')}
          className={`px-4 py-2 text-xs font-bold font-mono transition-all border-b-2 ${
            activeSubTab === 'CORRELATION'
              ? 'border-emerald-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          id="subtab_correlation_btn"
        >
          CORRELATION MATRIX
        </button>
      </div>

      {/* TAB CONTENT: DISCOVERY & SCORING */}
      {activeSubTab === 'RANKINGS' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <div className="bg-slate-950 rounded-lg border border-slate-850 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 font-mono text-[10px] uppercase">
                  <th className="p-3">Asset</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">24h Vol</th>
                  <th className="p-3">Spread</th>
                  <th className="p-3">24h Chg</th>
                  <th className="p-3">Trend</th>
                  <th className="p-3">RSI</th>
                  <th className="p-3">Macro</th>
                  <th className="p-3">AI Score</th>
                  <th className="p-3">Sentiment</th>
                  <th className="p-3">Total Score</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {rankings.map((rank) => (
                  <tr key={rank.symbol} className={`hover:bg-slate-900/50 transition-colors ${!rank.eligible ? 'opacity-45' : ''}`}>
                    <td className="p-3 font-mono font-extrabold text-slate-200">{rank.symbol}</td>
                    <td className="p-3 font-mono text-slate-300">${rank.metrics.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 font-mono text-slate-400">${(rank.metrics.volume24h / 1000000).toFixed(1)}M</td>
                    <td className="p-3 font-mono text-slate-400">{rank.metrics.spread.toFixed(3)}%</td>
                    <td className={`p-3 font-mono font-bold ${rank.metrics.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {rank.metrics.change24h >= 0 ? '+' : ''}{rank.metrics.change24h}%
                    </td>
                    <td className="p-3 font-mono text-slate-400">{rank.trendScore}/100</td>
                    <td className="p-3 font-mono text-slate-400">{rank.momentumScore}</td>
                    <td className="p-3 font-mono text-slate-400">{rank.macroScore}/100</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{rank.aiScore}/100</td>
                    <td className="p-3 font-mono text-slate-400">{rank.sentimentScore}/100</td>
                    <td className="p-3 font-mono font-extrabold text-emerald-300 text-sm">
                      {rank.totalScore}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        {rank.eligible ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" /> ELIGIBLE
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold font-mono bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded">
                            <XCircle className="w-3 h-3" /> FILTERED
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 bg-slate-950 p-4 rounded-lg border border-slate-850 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-slate-300 font-mono uppercase mr-1">Eligibility Criteria Details:</span>
                Assets are dynamically filtered out if volume drops below $5,000,000, or bid/ask spread spreads wider than 0.12%. Real-time Scores are calculated from raw technical feeds combined with Google GenAI sentiment classifications.
              </div>
            </div>
            
            <div className="flex items-start gap-2 border-t border-slate-900 pt-3">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-amber-300 font-mono uppercase mr-1">💡 NOTA DE NEGOCIAÇÃO REAL DA BINANCE:</span>
                Como esta demonstração na nuvem está hospedada em servidores nos EUA (Google Cloud Run), a Binance bloqueia automaticamente o acesso à API a partir desses IPs com o status <strong className="text-red-400">HTTP 451 (Unavailable For Legal Reasons)</strong>. 
                O sistema entra automaticamente em modo de simulação segura para proteger sua operação. Para realizar transações e rebalanceamento <strong>REAIS</strong> em sua conta, basta clonar este projeto e executá-lo <strong>localmente em seu computador</strong> (com <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">npm run dev</code>), onde a chamada de API não sofrerá bloqueio de IP de servidores americanos!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ISOLATED BOT STATE */}
      {activeSubTab === 'BOTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          {bots.length === 0 ? (
            <div className="col-span-full bg-slate-950 border border-slate-850 rounded-lg p-12 text-center flex flex-col items-center justify-center gap-3">
              <Cpu className="w-8 h-8 text-slate-600 animate-pulse" />
              <p className="text-sm font-bold text-slate-400 font-mono">No active asset bot instances running</p>
              <p className="text-xs text-slate-500">Wait for the scoring matrix to trigger entries or raise position configurations.</p>
            </div>
          ) : (
            bots.map((bot) => (
              <div key={bot.symbol} className="bg-slate-950 border border-slate-850 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden">
                {/* Active side indicator */}
                <div className={`absolute top-0 right-0 h-1.5 w-full ${
                  bot.side === 'LONG' ? 'bg-emerald-500' : bot.side === 'SHORT' ? 'bg-amber-500' : 'bg-slate-800'
                }`} />

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold text-slate-200 font-mono">{bot.symbol}</span>
                    <span className="text-[10px] font-mono text-slate-500">Cycle Time: {new Date(bot.lastCycleTime).toLocaleTimeString()}</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    bot.side === 'LONG'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : bot.side === 'SHORT'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-slate-800/15 border-slate-800 text-slate-400'
                  }`}>
                    {bot.side}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-slate-900 py-3 font-mono text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">Price:</span>
                    <span className="font-bold text-slate-200">${bot.currentPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">PnL:</span>
                    <span className={`font-bold ${bot.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${bot.pnl.toLocaleString()} ({bot.pnlPercent}%)
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">Entry Price:</span>
                    <span className="text-slate-400">${bot.entryPrice > 0 ? bot.entryPrice.toLocaleString() : '-'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">Size:</span>
                    <span className="text-slate-400">{bot.quantity > 0 ? bot.quantity : '-'}</span>
                  </div>
                </div>

                {bot.side !== 'FLAT' && (
                  <div className="flex flex-col gap-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[10px]">STOP LOSS (ATR):</span>
                      <span className="text-red-400 font-bold">${bot.stopLoss.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[10px]">TAKE PROFIT:</span>
                      <span className="text-emerald-400 font-bold">${bot.takeProfit.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB CONTENT: CORRELATION MATRIX */}
      {activeSubTab === 'CORRELATION' && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          <div className="bg-slate-950 rounded-xl p-6 border border-slate-850 overflow-x-auto">
            <div className="min-w-[600px] flex flex-col gap-1">
              {/* Header row */}
              <div className="flex items-center gap-1 mb-2 font-mono text-[10px] text-slate-500 text-center font-bold">
                <div className="w-20 text-left">SYMBOL</div>
                {Object.keys(correlation).map(s => (
                  <div key={s} className="flex-1 uppercase shrink-0">{s.replace('USDT', '')}</div>
                ))}
              </div>

              {/* Matrix rows */}
              {Object.entries(correlation).map(([sym, correlations]) => (
                <div key={sym} className="flex items-center gap-1 font-mono text-xs">
                  <div className="w-20 font-bold text-slate-400 text-left">{sym.replace('USDT', '')}</div>
                  {Object.values(correlations).map((val, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 text-center py-2.5 rounded border text-[11px] font-bold ${getCorrelationColor(val)}`}
                    >
                      {val.toFixed(2)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 bg-slate-950 p-4 rounded-lg border border-slate-850 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-slate-300 font-mono uppercase mr-1">CORRELATION PROTECTION LIMITS:</span>
              Positions are filtered dynamically when asset correlations flip above +0.65 to guarantee high diversification and prevent leverage/collateral crashes across correlated indices (like BTC/ETH/SOL).
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
