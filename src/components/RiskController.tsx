import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Sliders, RefreshCw } from 'lucide-react';
import { RiskEngine } from '../risk/RiskEngine';
import { PortfolioEngine } from '../portfolio/PortfolioEngine';

interface RiskControllerProps {
  onRiskChange: () => void;
}

export const RiskController: React.FC<RiskControllerProps> = ({ onRiskChange }) => {
  const riskEngine = RiskEngine.getInstance();
  const portfolioEngine = PortfolioEngine.getInstance();

  const [limits, setLimits] = useState(riskEngine.getLimits());
  const [winRate, setWinRate] = useState(55); // 55%
  const [riskReward, setRiskReward] = useState(2.0); // 2:1 RR

  const calculatedKelly = riskEngine.calculateKellyFraction(winRate / 100, riskReward);
  const calculatedATRSize = riskEngine.calculateATRSize(
    portfolioEngine.getPortfolioValue(),
    92450.5, // BTC Entry reference
    1850.0, // BTC ATR reference
    1.0 // 1% risk percent standard
  );

  const handleUpdateLimit = (key: keyof typeof limits, val: any) => {
    riskEngine.updateLimits({ [key]: val });
    setLimits(riskEngine.getLimits());
    onRiskChange();
  };

  const handleResetDaily = () => {
    riskEngine.resetDailyAccumulator();
    setLimits(riskEngine.getLimits());
    onRiskChange();
  };

  const handleKillSwitch = () => {
    riskEngine.triggerEmergencyKill('MANUAL_OPERATOR_KILL_SWITCH_ENGAGED');
    portfolioEngine.emergencyFlattenAll();
    setLimits(riskEngine.getLimits());
    onRiskChange();
  };

  // Portfolio VaR details
  const varProfile = riskEngine.evaluatePortfolioVaR(
    portfolioEngine.getPositions(),
    portfolioEngine.getBalances()
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4.5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
        <h2 className="font-semibold text-slate-100 text-sm">Risk Engine Sentry & Sizing Terminal</h2>
      </div>

      {/* EMERGENCY SENTINELS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleKillSwitch}
          className="flex-1 min-w-[140px] text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ShieldAlert className="w-4 h-4 animate-pulse" />
          EMERGENCY KILL SWITCH
        </button>
        <button
          onClick={handleResetDaily}
          className="flex-1 min-w-[140px] text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Daily Loss
        </button>
      </div>

      {/* PORTFOLIO VAR & EXPECTED SHORTFALL */}
      <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 flex flex-col gap-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
          Value-At-Risk Exposure Profile (1-Day)
        </span>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 p-2 rounded border border-slate-800">
            <p className="text-[10px] text-slate-400">95% Parametric VaR:</p>
            <p className="text-sm font-bold text-slate-200 font-mono mt-0.5">${varProfile.var95.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 p-2 rounded border border-slate-800">
            <p className="text-[10px] text-slate-400">Expected Shortfall (ES):</p>
            <p className="text-sm font-bold text-rose-400 font-mono mt-0.5">${varProfile.es95.toFixed(2)}</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          The VaR and Expected Shortfall are parametrically modeled based on active margined exposures. Max Daily Loss target limit is ${limits.dailyLossLimit}.
        </p>
      </div>

      {/* AT-RUN COGNITIVE KELLY CALCULATOR */}
      <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
            Cognitive Kelly & ATR Position Sizer
          </span>
        </div>

        {/* Win Rate Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Model Win Probability:</span>
            <span className="text-emerald-400 font-bold">{winRate}%</span>
          </div>
          <input
            type="range"
            min="20"
            max="90"
            value={winRate}
            onChange={(e) => setWinRate(parseInt(e.target.value))}
            className="w-full accent-emerald-500 bg-slate-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>

        {/* Reward Risk Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Target Reward/Risk Ratio:</span>
            <span className="text-emerald-400 font-bold">{riskReward.toFixed(1)}:1</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={riskReward}
            onChange={(e) => setRiskReward(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 bg-slate-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 gap-3 mt-1.5 pt-2 border-t border-slate-900">
          <div>
            <span className="text-[9px] text-slate-500 block">Recommended Kelly Fraction:</span>
            <span className="text-xs font-bold text-slate-200 font-mono">{(calculatedKelly * 100).toFixed(1)}% Capital</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block">ATR stop size (BTC Ref):</span>
            <span className="text-xs font-bold text-slate-200 font-mono">{calculatedATRSize} BTC</span>
          </div>
        </div>
      </div>

      {/* EDITABLE RISK BOUNDARIES */}
      <div className="flex flex-col gap-2 bg-slate-950 rounded-lg p-3 border border-slate-850">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">
          Hard Sentry Limits Setup
        </span>
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Max Daily Loss Limit ($):</span>
          <input
            type="number"
            value={limits.dailyLossLimit}
            onChange={(e) => handleUpdateLimit('dailyLossLimit', parseInt(e.target.value) || 0)}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 w-24 text-right font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 text-xs"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-300 mt-1">
          <span>Max Drawdown Limit (%):</span>
          <input
            type="number"
            value={limits.maxDrawdownLimit}
            onChange={(e) => handleUpdateLimit('maxDrawdownLimit', parseFloat(e.target.value) || 0)}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 w-24 text-right font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 text-xs"
          />
        </div>
      </div>
    </div>
  );
};
