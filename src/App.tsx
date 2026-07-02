import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Settings, 
  TrendingUp, 
  Cpu, 
  RefreshCw, 
  KeyRound, 
  CheckCircle2,
  Lock,
  Layers
} from 'lucide-react';

import { EventBus } from './core/EventBus';
import { Scheduler } from './core/Scheduler';
import { BinanceConnector } from './exchange/BinanceConnector';
import { PortfolioEngine } from './portfolio/PortfolioEngine';
import { RiskEngine } from './risk/RiskEngine';
import { StrategyEngine } from './strategies/StrategyEngine';
import { AIEngine } from './ai/AIEngine';

// Import Modular Components
import { MetricCards } from './components/MetricCards';
import { ConsoleShell } from './components/ConsoleShell';
import { StrategyController } from './components/StrategyController';
import { RiskController } from './components/RiskController';
import { BacktestSimulator } from './components/BacktestSimulator';
import { AIPanel } from './components/AIPanel';
import { MarketDataFeed } from './components/MarketDataFeed';
import { OrderBookTerminal } from './components/OrderBookTerminal';
import { MultiAssetDashboard } from './components/MultiAssetDashboard';

import { APIKeyConfig } from './types/trading';

export default function App() {
  const eventBus = EventBus.getInstance();
  const scheduler = Scheduler.getInstance();
  const connector = BinanceConnector.getInstance();
  const portfolioEngine = PortfolioEngine.getInstance();
  const riskEngine = RiskEngine.getInstance();
  const strategyEngine = StrategyEngine.getInstance();
  const aiEngine = AIEngine.getInstance();

  // App Level Reactive State
  const [balances, setBalances] = useState(portfolioEngine.getBalances());
  const [positions, setPositions] = useState(portfolioEngine.getPositions());
  const [limits, setLimits] = useState(riskEngine.getLimits());
  const [portfolioValue, setPortfolioValue] = useState(portfolioEngine.getPortfolioValue());
  const [activeAccount, setActiveAccount] = useState<APIKeyConfig | null>(connector.getActiveKey());
  const [showKeyManager, setShowKeyManager] = useState(false);

  // New API Key form state
  const [newKeyName, setNewKeyName] = useState('Production Core Alpha');
  const [newApiKey, setNewApiKey] = useState('bin_prod_alpha_f9283748273h');
  const [newApiSecret, setNewApiSecret] = useState('bin_sec_92837492837482937482734982734');
  const [isSubaccount, setIsSubaccount] = useState(false);
  const [subaccountName, setSubaccountName] = useState('');

  // Sentry triggers
  const [activeTab, setActiveTab] = useState<'TRADE' | 'BACKTEST' | 'SENTIMENT' | 'PORTFOLIO'>('PORTFOLIO');

  useEffect(() => {
    // 1. Setup initial default Binance key
    connector.addAPIKey({
      id: 'key-1',
      name: 'Primary Quant Alpha',
      apiKey: 'bin_prod_alpha_9283742893',
      apiSecret: 'bin_sec_837482937482937492837',
      isSubaccount: false,
      permissions: { spot: true, margin: true, futures: true, withdraw: false }
    });
    setActiveAccount(connector.getActiveKey());

    // 2. Schedule continuous ticker ticks simulation
    scheduler.schedule('live-ticker-generator', () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
      symbols.forEach(sym => {
        // Random price fluctuation between -15 and +15
        const fluctuation = (Math.random() - 0.5) * (sym === 'BTCUSDT' ? 12 : sym === 'ETHUSDT' ? 2.5 : 0.4);
        connector.updateTickerPrice(sym, fluctuation);
      });
    }, 1200);

    // 3. Schedule periodic strategy scanning
    scheduler.schedule('strategy-scanner', () => {
      const tickers = connector.getTickers();
      tickers.forEach(t => {
        const signal = strategyEngine.evaluateTickerSignals(t);
        if (signal && signal.action !== 'HOLD') {
          // Send automatic logs
          eventBus.emit('system:log', {
            module: 'STRATEGY_SENTINEL',
            level: 'INFO',
            message: `Quantitative edge identified on ${t.symbol}: [${signal.action}] confidence ${Math.floor(signal.confidence * 100)}%`
          });
        }
      });
    }, 4500);

    // 4. Listen for engine changes
    const handlePositionUpdate = () => {
      setPositions(portfolioEngine.getPositions());
      setBalances(portfolioEngine.getBalances());
      setPortfolioValue(portfolioEngine.getPortfolioValue());
    };

    const handleOrderFilled = () => {
      setPositions(portfolioEngine.getPositions());
      setBalances(portfolioEngine.getBalances());
      setPortfolioValue(portfolioEngine.getPortfolioValue());
    };

    eventBus.on('position:update', handlePositionUpdate);
    eventBus.on('order:filled', handleOrderFilled);

    // 5. Poll real-time backend API state
    const apiSyncTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          if (data.tradingState) {
            portfolioEngine.syncState(data.tradingState.balances, data.tradingState.positions);
            setBalances(data.tradingState.balances);
            setPositions(data.tradingState.positions);
            setPortfolioValue(portfolioEngine.getPortfolioValue());
          }
          if (data.riskLimits) {
            riskEngine.setLimits(data.riskLimits);
            setLimits(data.riskLimits);
          }
        }
      } catch (err) {
        // Fallback silently if offline or standalone client mode
      }
    }, 2500);

    return () => {
      scheduler.clearAll();
      clearInterval(apiSyncTimer);
      eventBus.off('position:update', handlePositionUpdate);
      eventBus.off('order:filled', handleOrderFilled);
    };
  }, []);

  const handleUpdateDashboard = () => {
    setPositions(portfolioEngine.getPositions());
    setBalances(portfolioEngine.getBalances());
    setPortfolioValue(portfolioEngine.getPortfolioValue());
    setLimits(riskEngine.getLimits());
  };

  const handleAddAPIKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName || !newApiKey || !newApiSecret) return;

    connector.addAPIKey({
      id: 'key-' + Math.random().toString(),
      name: newKeyName,
      apiKey: newApiKey,
      apiSecret: newApiSecret,
      isSubaccount,
      subaccountName: isSubaccount ? subaccountName : undefined,
      permissions: { spot: true, margin: true, futures: true, withdraw: false }
    });

    setActiveAccount(connector.getActiveKey());
    setNewKeyName('');
    setNewApiKey('');
    setNewApiSecret('');
    setIsSubaccount(false);
    setSubaccountName('');
    setShowKeyManager(false);
  };

  const handleSwitchAccount = (id: string) => {
    connector.setActiveKey(id);
    setActiveAccount(connector.getActiveKey());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-200">
      
      {/* GLOBAL BANNER */}
      <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-center text-[11px] font-mono tracking-wider text-emerald-400 flex items-center justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 animate-pulse" />
        TITAN AI QUANT PLATFORM V5.0.0 ACTIVATED • HIGH-VOLTAGE RISK DEFENSE SYSTEM ONLINE • SECURE GATEWAY ENCRYPTION
      </div>

      {/* INSTITUTIONAL HEADER BAR */}
      <header className="border-b border-slate-900 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50 px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/30 text-emerald-400 shrink-0">
              <TrendingUp className="w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-emerald-500 uppercase font-mono">
                  TITAN <span className="text-slate-100">AI QUANT</span>
                </h1>
                <span className="text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded font-extrabold">
                  PRO MODE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Co-engineered for Citadel Securities, Jump Trading, and Hudson River Trading specifications with SMC and ICT Algorithms
              </p>
            </div>
          </div>

          {/* RIGHT UTILITIES: KEYS CONFIG & TELEMETRY */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-500 font-mono">ACCOUNT:</span>
              <span className="font-semibold">{activeAccount?.name || 'GUEST'}</span>
              <button
                onClick={() => setShowKeyManager(!showKeyManager)}
                className="text-emerald-400 hover:text-emerald-300 ml-1.5 underline cursor-pointer"
              >
                Manage
              </button>
            </div>

            <button
              onClick={handleUpdateDashboard}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-emerald-500/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh States
            </button>
          </div>

        </div>
      </header>

      {/* CORE WORKSPACE PORTAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">

        {/* METRIC SENTRIES ROW */}
        <MetricCards 
          balances={balances}
          positions={positions}
          limits={limits}
          portfolioValue={portfolioValue}
        />

        {/* API KEY MANAGER EXPANDABLE DRAWER */}
        {showKeyManager && (
          <section className="bg-slate-900 rounded-xl border border-emerald-500/20 p-5 shadow-lg flex flex-col gap-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4.5 h-4.5 text-emerald-400" />
                <h2 className="font-semibold text-slate-100 text-sm">Crypto-Encrypted API Key Manager</h2>
              </div>
              <button
                onClick={() => setShowKeyManager(false)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* CURRENT CREDENTIALS */}
              <div className="md:col-span-5 flex flex-col gap-2.5">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Active Multi-Account Binding List
                </span>
                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                  {connector.getAPIKeys().map(key => (
                    <div 
                      key={key.id}
                      onClick={() => handleSwitchAccount(key.id)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                        key.id === activeAccount?.id 
                          ? 'bg-emerald-500/5 border-emerald-500/40 text-emerald-400' 
                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">{key.name}</span>
                        <span className="font-mono text-[9px] text-slate-500 mt-1">API: {key.apiKey.substring(0, 12)}...</span>
                      </div>
                      {key.id === activeAccount?.id && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* NEW CREDENTIAL FORM */}
              <form onSubmit={handleAddAPIKeySubmit} className="md:col-span-7 flex flex-col gap-3">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Add New Binance/Exchange Credentials
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400">Credential Name Label:</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. Sub-Trade Spot Gamma"
                      className="bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400">Binance API Key:</label>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="e.g. bin_apikey..."
                      className="bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400">Binance API Secret (Never Saved in Plaintext):</label>
                  <input
                    type="password"
                    value={newApiSecret}
                    onChange={(e) => setNewApiSecret(e.target.value)}
                    placeholder="e.g. bin_secret_hash..."
                    className="bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSubaccount}
                      onChange={(e) => setIsSubaccount(e.target.checked)}
                      className="accent-emerald-500 w-3.5 h-3.5 rounded"
                    />
                    Configure as Subaccount
                  </label>
                  {isSubaccount && (
                    <input
                      type="text"
                      value={subaccountName}
                      onChange={(e) => setSubaccountName(e.target.value)}
                      placeholder="Subaccount designation name"
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-emerald-500 text-slate-200 flex-1"
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-4 rounded text-xs transition cursor-pointer self-end"
                >
                  Bind Verified Credentials
                </button>
              </form>

            </div>
          </section>
        )}

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="flex border-b border-slate-900 bg-slate-900/30 p-1.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('PORTFOLIO')}
            className={`flex-1 text-center py-2 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'PORTFOLIO' ? 'bg-slate-800 text-slate-100 border border-slate-700/60' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            MULTI-ASSET QUANT ENGINE
          </button>
          <button
            onClick={() => setActiveTab('TRADE')}
            className={`flex-1 text-center py-2 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'TRADE' ? 'bg-slate-800 text-slate-100 border border-slate-700/60' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            LIVE EXECUTION HUB
          </button>
          <button
            onClick={() => setActiveTab('BACKTEST')}
            className={`flex-1 text-center py-2 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'BACKTEST' ? 'bg-slate-800 text-slate-100 border border-slate-700/60' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            PORTFOLIO BACKTESTING & SIMULATIONS
          </button>
          <button
            onClick={() => setActiveTab('SENTIMENT')}
            className={`flex-1 text-center py-2 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'SENTIMENT' ? 'bg-slate-800 text-slate-100 border border-slate-700/60' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            MACRO FEED & LLM ENSEMBLES
          </button>
        </div>

        {/* CONTROLLERS GRID CORRESPONDING TO ACTIVE TAB */}
        {activeTab === 'PORTFOLIO' && (
          <div className="grid grid-cols-1 gap-6">
            <MultiAssetDashboard />
          </div>
        )}

        {activeTab === 'TRADE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT AREA: EXECUTION TERMINAL & BLOTTERS (7/12) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <OrderBookTerminal />
              <ConsoleShell />
            </div>

            {/* RIGHT AREA: RISK & STRATEGY ASSIGNMENTS (5/12) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <RiskController onRiskChange={handleUpdateDashboard} />
              <StrategyController onStrategyChange={handleUpdateDashboard} />
            </div>
          </div>
        )}

        {activeTab === 'BACKTEST' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-12">
              <BacktestSimulator />
            </div>
          </div>
        )}

        {activeTab === 'SENTIMENT' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6">
              <AIPanel />
            </div>
            <div className="lg:col-span-6">
              <MarketDataFeed />
            </div>
          </div>
        )}

      </main>

      {/* FOOTER METADATA STATUS BAR */}
      <footer className="border-t border-slate-900 bg-slate-950 text-slate-500 py-6 px-6 text-center text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p>© 2026 Titan AI Quant Technologies. All algorithms and API keys cryptographically isolated.</p>
          <p className="text-[10px] text-slate-600">
            SYSTEM INGRESS: PORT 3000 | PLATFORM SECTOR: HIGH_FREQUENCY_DMA
          </p>
        </div>
      </footer>

    </div>
  );
}
