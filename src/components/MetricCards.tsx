import React from 'react';
import { ShieldCheck, TrendingUp, DollarSign, Zap } from 'lucide-react';
import { AccountBalance, Position, RiskLimits } from '../types/trading';

interface MetricCardsProps {
  balances: AccountBalance[];
  positions: Position[];
  limits: RiskLimits;
  portfolioValue: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  balances,
  positions,
  limits,
  portfolioValue
}) => {
  const activeUnrealizedPnl = positions.reduce((acc, pos) => acc + pos.unrealizedPnl, 0);
  const totalMarginUsed = positions.reduce((acc, pos) => acc + pos.margin, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* CARD 1: TOTAL CAPITAL */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition">
        <div className="absolute right-0 top-0 text-emerald-500/5 translate-x-3 -translate-y-3 shrink-0">
          <DollarSign className="w-32 h-32" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
            Total Capital Equity
          </span>
          <span className="text-2xl font-bold tracking-tight text-slate-100 font-mono mt-1">
            ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Spot + Futures margined
          </span>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>

      {/* CARD 2: UNREALIZED PNL */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition">
        <div className="absolute right-0 top-0 text-slate-500/5 translate-x-3 -translate-y-3 shrink-0">
          <TrendingUp className="w-32 h-32" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
            Unrealized Portfolio PnL
          </span>
          <span className={`text-2xl font-bold tracking-tight font-mono mt-1 ${
            activeUnrealizedPnl > 0 ? 'text-emerald-400' : activeUnrealizedPnl < 0 ? 'text-rose-500' : 'text-slate-300'
          }`}>
            {activeUnrealizedPnl >= 0 ? '+' : ''}${activeUnrealizedPnl.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1">
            Across {positions.length} active positions
          </span>
        </div>
        <div className={`p-3 rounded-lg border ${
          activeUnrealizedPnl >= 0 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      {/* CARD 3: MARGIN USAGE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition">
        <div className="absolute right-0 top-0 text-slate-500/5 translate-x-3 -translate-y-3 shrink-0">
          <Zap className="w-32 h-32" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
            Total Margins Utilized
          </span>
          <span className="text-2xl font-bold tracking-tight text-slate-100 font-mono mt-1">
            ${totalMarginUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 mt-1">
            Leverage collateral ratio: {((totalMarginUsed / (portfolioValue || 1)) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Zap className="w-5 h-5" />
        </div>
      </div>

      {/* CARD 4: RISK STATUS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition">
        <div className="absolute right-0 top-0 text-slate-500/5 translate-x-3 -translate-y-3 shrink-0">
          <ShieldCheck className="w-32 h-32" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
            Sentry Circuit Breaker
          </span>
          <span className={`text-2xl font-bold tracking-tight mt-1 uppercase ${
            limits.killSwitchActive ? 'text-rose-500 font-bold' : limits.circuitBreakerActive ? 'text-amber-500' : 'text-emerald-400'
          }`}>
            {limits.killSwitchActive ? 'KILLED' : limits.circuitBreakerActive ? 'TRIGGERED' : 'ARMED / SAFE'}
          </span>
          <span className="text-[10px] text-slate-400 mt-1">
            Daily threshold loss: ${limits.dailyLossLimit} USD
          </span>
        </div>
        <div className={`p-3 rounded-lg border ${
          limits.killSwitchActive || limits.circuitBreakerActive 
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
