import React, { useState, useEffect } from 'react';
import { Newspaper, BellRing, Calendar, Smile, List, ArrowUpRight, BarChart3 } from 'lucide-react';
import { ExternalDataMetrics } from '../types/trading';

interface FearAndGreedItem {
  value: string;
  value_classification: string;
  timestamp: string;
}

interface AlternativeMeCoin {
  id: number;
  name: string;
  symbol: string;
  website_slug: string;
}

export const MarketDataFeed: React.FC = () => {
  const [fngHistory, setFngHistory] = useState<FearAndGreedItem[]>([]);
  const [listings, setListings] = useState<AlternativeMeCoin[]>([]);
  const [loadingFng, setLoadingFng] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
  const [subTab, setSubTab] = useState<'OVERVIEW' | 'FNG_HISTORY' | 'LISTINGS'>('OVERVIEW');

  const [metrics] = useState<ExternalDataMetrics>({
    fearAndGreedIndex: 78, // Fallback base value
    fundingRateAvg: 0.00012, // +12% annualized base rate
    openInterestTotal: 34500000000, // $34.5B
    whaleAlerts: [
      { hash: 'wh-12', symbol: 'BTC', amountUsd: 145000000, from: 'Unknown Wallet', to: 'Binance', time: '14 mins ago' },
      { hash: 'wh-15', symbol: 'ETH', amountUsd: 48000000, from: 'Kraken', to: 'Unknown Wallet', time: '28 mins ago' },
      { hash: 'wh-20', symbol: 'SOL', amountUsd: 12000000, from: 'Unknown Wallet', to: 'Coinbase', time: '52 mins ago' }
    ],
    economicEvents: [
      { title: 'Core CPI (MoM)', time: 'Tomorrow 05:30', importance: 'HIGH', forecast: '0.2%', actual: undefined },
      { title: 'FOMC Interest Rate Decision', time: 'In 3 Days 11:00', importance: 'HIGH', forecast: '5.25%', actual: undefined },
      { title: 'Initial Jobless Claims', time: 'In 2 Days 05:30', importance: 'MEDIUM', forecast: '215K', actual: undefined }
    ]
  });

  useEffect(() => {
    // Fetch Fear & Greed Index History (10 items)
    fetch('/api/alternativeme/fng?limit=10')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setFngHistory(data.data);
        }
      })
      .catch(err => console.error('Error fetching FNG history:', err))
      .finally(() => setLoadingFng(false));

    // Fetch Cryptocurrencies Listings
    fetch('/api/alternativeme/listings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          // Convert record map to array list
          const list: AlternativeMeCoin[] = Object.values(data.data);
          setListings(list);
        }
      })
      .catch(err => console.error('Error fetching listings:', err))
      .finally(() => setLoadingListings(false));
  }, []);

  // Helper for FNG Classification visual styles
  const getFngColor = (valStr: string) => {
    const val = parseInt(valStr) || 50;
    if (val >= 75) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
    if (val >= 55) return 'text-teal-400 border-teal-500/30 bg-teal-500/5';
    if (val >= 45) return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
    if (val >= 25) return 'text-orange-400 border-orange-500/30 bg-orange-500/5';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/5';
  };

  const getLatestFngValue = () => {
    if (fngHistory.length > 0) {
      return fngHistory[0].value;
    }
    return String(metrics.fearAndGreedIndex);
  };

  const getLatestFngClassification = () => {
    if (fngHistory.length > 0) {
      return fngHistory[0].value_classification;
    }
    return 'Greed';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4.5 h-4.5 text-emerald-400" />
          <h2 className="font-semibold text-slate-100 text-sm font-mono uppercase tracking-wider">Quant Sentiment & Macro</h2>
        </div>
        
        {/* SUB-TABS */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850 gap-1 shrink-0">
          <button
            onClick={() => setSubTab('OVERVIEW')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
              subTab === 'OVERVIEW' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSubTab('FNG_HISTORY')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
              subTab === 'FNG_HISTORY' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Fear & Greed (10D)
          </button>
          <button
            onClick={() => setSubTab('LISTINGS')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
              subTab === 'LISTINGS' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Crypto Listings
          </button>
        </div>
      </div>

      {subTab === 'OVERVIEW' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* METRICS ROW */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg border flex items-center justify-between transition ${getFngColor(getLatestFngValue())}`}>
              <div className="text-xs">
                <span className="text-slate-400 block font-semibold text-[10px] uppercase font-mono">Fear & Greed:</span>
                <span className="font-extrabold mt-1 block text-base font-mono">{getLatestFngValue()} / 100</span>
                <span className="text-[10px] opacity-80 font-mono mt-0.5 block">{getLatestFngClassification()}</span>
              </div>
              <Smile className="w-6 h-6 shrink-0" />
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-slate-500 block font-semibold text-[10px] uppercase font-mono">Total Open Interest:</span>
                <span className="font-extrabold text-slate-200 mt-1 block text-base font-mono">${(metrics.openInterestTotal / 1000000000).toFixed(1)}B</span>
                <span className="text-[10px] text-slate-500 block font-mono">Simulated Aggregated</span>
              </div>
              <BellRing className="w-6 h-6 text-indigo-400 shrink-0" />
            </div>
          </div>

          {/* WHALE ALERTS */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Whale Alert Sentry Feed
            </span>
            <div className="flex flex-col gap-2">
              {metrics.whaleAlerts.map(alert => (
                <div key={alert.hash} className="bg-slate-950/60 p-2.5 rounded border border-slate-850 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-300">
                      Transfer of {alert.symbol} (${(alert.amountUsd / 1000000).toFixed(1)}M)
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      From: {alert.from} → To: {alert.to}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{alert.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ECONOMIC CALENDAR */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Macro Economic Calendar (CPI / FOMC)
            </span>
            <div className="flex flex-col gap-2">
              {metrics.economicEvents.map(event => (
                <div key={event.title} className="bg-slate-950/60 p-2.5 rounded border border-slate-850 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      {event.title}
                      {event.importance === 'HIGH' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Scheduled: {event.time}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Forecast:</span>
                    <span className="font-mono text-slate-300">{event.forecast || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'FNG_HISTORY' && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 border border-slate-800/60 bg-slate-950 p-2.5 rounded-lg text-xs text-slate-400 mb-1">
            <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono">Real-time Crypto Sentiment history direct from Alternative.me API.</span>
          </div>

          {loadingFng ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs font-mono gap-2">
              <span className="w-5 h-5 rounded-full border-2 border-slate-800 border-t-emerald-500 animate-spin" />
              Loading Index history...
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[350px] overflow-y-auto pr-1">
              {fngHistory.map((item, idx) => {
                const dateStr = new Date(Number(item.timestamp) * 1000).toLocaleDateString('pt-BR', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                return (
                  <div 
                    key={item.timestamp + idx} 
                    className={`p-2.5 rounded border flex items-center justify-between transition text-xs ${getFngColor(item.value)}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[10px] bg-slate-950 border border-slate-850 px-1.5 py-0.5 rounded">
                        {dateStr}
                      </span>
                      {idx === 0 && (
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase px-1 rounded">
                          LATEST
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{item.value_classification}</span>
                      <span className="font-extrabold font-mono text-right w-8">{item.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'LISTINGS' && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 border border-slate-800/60 bg-slate-950 p-2.5 rounded-lg text-xs text-slate-400 mb-1">
            <List className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-mono text-[11px]">
              Active cryptocurrency assets indexed for multi-asset analytics:
            </span>
          </div>

          {loadingListings ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs font-mono gap-2">
              <span className="w-5 h-5 rounded-full border-2 border-slate-800 border-t-indigo-500 animate-spin" />
              Indexing listings from Alternative.me...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
              {listings.slice(0, 30).map(coin => (
                <div 
                  key={coin.id} 
                  className="bg-slate-950 hover:bg-slate-950/80 p-2.5 rounded border border-slate-850 hover:border-slate-800 flex items-center justify-between text-xs transition"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-bold text-slate-200 truncate">{coin.name}</span>
                    <span className="font-mono text-[10px] text-indigo-400 uppercase tracking-wide">{coin.symbol}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">
                    #{coin.id}
                  </span>
                </div>
              ))}
              {listings.length > 30 && (
                <div className="col-span-2 text-center py-2 text-[10px] font-mono text-slate-500 border border-dashed border-slate-800 rounded bg-slate-950/20">
                  + {listings.length - 30} additional indexed assets available for quant logic
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
