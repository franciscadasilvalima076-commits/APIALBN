import React, { useState } from 'react';
import { Sparkles, BrainCircuit, Vote, ChevronDown, ChevronUp } from 'lucide-react';
import { AIEngine } from '../ai/AIEngine';
import { AIEnsembleReport } from '../types/trading';

export const AIPanel: React.FC = () => {
  const aiEngine = AIEngine.getInstance();
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [report, setReport] = useState<AIEnsembleReport | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [expandedOpinion, setExpandedOpinion] = useState<string | null>(null);

  const handleEvaluateAI = () => {
    setIsEvaluating(true);
    setReport(null);

    // Simulate model predictions
    setTimeout(() => {
      const res = aiEngine.generateEnsembleReport(symbol, 92450.5, 3.25);
      setReport(res);
      setIsEvaluating(false);
    }, 900);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4.5 h-4.5 text-emerald-400" />
          <h2 className="font-semibold text-slate-100 text-sm">LLM AI Consensus Voting Engine</h2>
        </div>
        <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-emerald-400 font-mono">
          Ensemble Models Active
        </span>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[9px] font-mono text-slate-500 uppercase">Select Target Asset:</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-emerald-500 cursor-pointer w-full"
          >
            <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
            <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
            <option value="SOLUSDT">SOLUSDT (Solana)</option>
            <option value="BNBUSDT">BNBUSDT (Binance Coin)</option>
          </select>
        </div>
        <button
          onClick={handleEvaluateAI}
          disabled={isEvaluating}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-3.5 rounded-lg text-xs transition shadow-md flex items-center gap-1 cursor-pointer whitespace-nowrap h-[34px]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isEvaluating ? 'Evaluating Ensemble...' : 'Query AI Consensus'}
        </button>
      </div>

      {isEvaluating ? (
        <div className="text-center py-10">
          <span className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin inline-block mb-3" />
          <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Compiling Model Predictions...</p>
        </div>
      ) : report ? (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* CONSENSUS CARD */}
          <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Consensus Output Matrix
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                report.ensembleAction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                report.ensembleAction === 'SELL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                ACTION: {report.ensembleAction}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-900 p-2 rounded border border-slate-850">
                <p className="text-[10px] text-slate-500">Confidence Score:</p>
                <p className="text-sm font-bold text-slate-200 mt-0.5">{report.compositeScore}%</p>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-850">
                <p className="text-[10px] text-slate-500">Market Regime:</p>
                <p className="text-[10px] font-semibold text-emerald-400 mt-0.5 whitespace-nowrap">{report.regimeDetected.replace('_', ' ')}</p>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-850">
                <p className="text-[10px] text-slate-500">AI Risk Rating:</p>
                <p className="text-sm font-bold text-slate-200 mt-0.5">{report.aiRiskScore}/10</p>
              </div>
            </div>

            <div className="bg-slate-900/40 p-2.5 rounded border border-slate-900 text-xs text-slate-400 leading-relaxed italic">
              "{report.tradeExplanation}"
            </div>
          </div>

          {/* INDIVIDUAL OPINION FEED */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Model Opinion Feed
            </span>
            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
              {report.opinions.map(op => {
                const isExpanded = expandedOpinion === op.modelName;
                return (
                  <div key={op.modelName} className="bg-slate-950/60 rounded border border-slate-850 p-2 text-xs flex flex-col gap-1">
                    <button
                      onClick={() => setExpandedOpinion(isExpanded ? null : op.modelName)}
                      className="flex items-center justify-between text-left cursor-pointer w-full"
                    >
                      <span className="font-semibold text-slate-300">{op.modelName}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${
                          op.action === 'BUY' ? 'text-emerald-400' : op.action === 'SELL' ? 'text-rose-400' : 'text-slate-500'
                        }`}>
                          {op.action} ({(op.confidence * 100).toFixed(0)}%)
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <p className="text-[11px] text-slate-400 border-t border-slate-900 pt-1.5 mt-1 leading-relaxed">
                        {op.rationale}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-600">
          <Sparkles className="w-8 h-8 text-slate-800 mx-auto mb-2" />
          <p className="text-xs">Consensus engine idle. Query predictions to aggregate LLM model weights.</p>
        </div>
      )}
    </div>
  );
};
