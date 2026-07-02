import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Settings2, ShieldCheck, Cpu } from 'lucide-react';
import { StrategyEngine, StrategyDefinition } from '../strategies/StrategyEngine';

interface StrategyControllerProps {
  onStrategyChange: () => void;
}

export const StrategyController: React.FC<StrategyControllerProps> = ({ onStrategyChange }) => {
  const strategyEngine = StrategyEngine.getInstance();
  const [strategies, setStrategies] = useState<StrategyDefinition[]>(strategyEngine.getStrategies());
  const [editingStrat, setEditingStrat] = useState<string | null>(null);
  const [editingParams, setEditingParams] = useState<{ [key: string]: number }>({});

  const handleToggle = (name: string) => {
    strategyEngine.toggleStrategy(name);
    setStrategies(strategyEngine.getStrategies());
    onStrategyChange();
  };

  const handleEditClick = (strat: StrategyDefinition) => {
    setEditingStrat(strat.name);
    setEditingParams({ ...strat.parameters });
  };

  const handleParamChange = (key: string, value: number) => {
    setEditingParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveParams = (name: string) => {
    strategyEngine.updateParameters(name, editingParams);
    setStrategies(strategyEngine.getStrategies());
    setEditingStrat(null);
    onStrategyChange();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Cpu className="w-4.5 h-4.5 text-emerald-400" />
        <h2 className="font-semibold text-slate-100 text-sm">Algorithmic Strategy Portfolio</h2>
      </div>

      <div className="flex flex-col gap-3.5 max-h-[320px] overflow-y-auto pr-1">
        {strategies.map((strat) => (
          <div key={strat.name} className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 flex flex-col gap-2 hover:border-emerald-500/10 transition">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-900 border border-slate-800 text-emerald-400">
                  {strat.type}
                </span>
                <h3 className="text-xs font-semibold text-slate-200 mt-1.5">{strat.name}</h3>
              </div>
              <button
                onClick={() => handleToggle(strat.name)}
                className="cursor-pointer text-slate-400 hover:text-emerald-400 transition shrink-0"
              >
                {strat.isActive ? (
                  <ToggleRight className="w-8 h-8 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">{strat.description}</p>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900">
              <span className="text-[10px] font-mono text-slate-500">Parameters:</span>
              <button
                onClick={() => handleEditClick(strat)}
                className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Tune Model
              </button>
            </div>

            {/* Editing Parameters Section */}
            {editingStrat === strat.name ? (
              <div className="bg-slate-900 border border-slate-850 rounded p-2.5 mt-2 flex flex-col gap-2.5">
                {Object.keys(editingParams).map((key) => (
                  <div key={key} className="flex items-center justify-between gap-4 text-[11px]">
                    <span className="font-mono text-slate-400">{key}:</span>
                    <input
                      type="number"
                      step="any"
                      value={editingParams[key]}
                      onChange={(e) => handleParamChange(key, parseFloat(e.target.value) || 0)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 w-20 font-mono text-right text-emerald-400 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                ))}
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    onClick={() => setEditingStrat(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1 bg-slate-950 hover:bg-slate-800 rounded transition border border-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveParams(strat.name)}
                    className="text-[10px] text-slate-950 font-bold px-2 py-1 bg-emerald-500 hover:bg-emerald-400 rounded transition cursor-pointer"
                  >
                    Save Tuning
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {Object.entries(strat.parameters).map(([key, val]) => (
                  <span key={key} className="text-[10px] font-mono text-slate-400">
                    {key}: <strong className="text-emerald-400/90">{val}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
