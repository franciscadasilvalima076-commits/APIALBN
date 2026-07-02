import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, Play, Trash2 } from 'lucide-react';
import { EventBus } from '../core/EventBus';

interface SystemLog {
  id: string;
  module: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
}

export const ConsoleShell: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([
    { id: 'init-1', module: 'QUANT_SENTRY', level: 'SUCCESS', message: 'Institutional high-frequency trading sentry armed.', timestamp: '16:15:11' },
    { id: 'init-2', module: 'PORTFOLIO_ENGINE', level: 'INFO', message: 'Loading multi-asset cross margin engines.', timestamp: '16:15:11' }
  ]);
  const [shellInput, setShellInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventBus = EventBus.getInstance();

  useEffect(() => {
    // Poll logs from Express API
    const fetchServerLogs = async () => {
      try {
        const response = await fetch('/api/logs?file=system.log');
        if (response.ok) {
          const data = await response.json();
          if (data.logs && data.logs.length > 0) {
            const parsed = data.logs.map((line: string, idx: number) => {
              // Format: [timestamp] [level] [module] message
              const regex = /^\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)$/;
              const match = line.match(regex);
              if (match) {
                const [, fullTime, level, module, message] = match;
                const timeOnly = fullTime.includes('T') ? fullTime.split('T')[1].split('.')[0] : fullTime;
                return {
                  id: `srv-${idx}-${fullTime}`,
                  module,
                  level: level === 'WARN' ? 'WARN' : level === 'ERROR' ? 'ERROR' : level === 'SUCCESS' ? 'SUCCESS' : 'INFO',
                  message,
                  timestamp: timeOnly
                };
              }
              return {
                id: `srv-raw-${idx}`,
                module: 'SYSTEM',
                level: 'INFO',
                message: line,
                timestamp: ''
              };
            });
            setLogs(parsed);
          }
        }
      } catch (err) {
        // Fallback silently if offline or standalone client mode
      }
    };

    fetchServerLogs();
    const timer = setInterval(fetchServerLogs, 2500);

    // Listen for system logs locally
    const handleLog = (payload: { module: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'; message: string }) => {
      const timeStr = new Date().toTimeString().split(' ')[0];
      setLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          module: payload.module,
          level: payload.level,
          message: payload.message,
          timestamp: timeStr
        }
      ].slice(-80));
    };

    // Listen for risk alerts
    const handleAlert = (payload: { level: 'INFO' | 'WARNING' | 'CRITICAL' | 'KILL_SWITCH'; message: string }) => {
      const timeStr = new Date().toTimeString().split(' ')[0];
      const mappingLevel: SystemLog['level'] = 
        payload.level === 'WARNING' ? 'WARN' : 
        payload.level === 'CRITICAL' || payload.level === 'KILL_SWITCH' ? 'ERROR' : 'INFO';

      setLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          module: 'SENTRY_RISK_ALERT',
          level: mappingLevel,
          message: `[ALERT: ${payload.level}] ${payload.message}`,
          timestamp: timeStr
        }
      ].slice(-80));
    };

    eventBus.on('system:log', handleLog);
    eventBus.on('risk:alert', handleAlert);

    return () => {
      clearInterval(timer);
      eventBus.off('system:log', handleLog);
      eventBus.off('risk:alert', handleAlert);
    };
  }, []);

  // Scroll to bottom when logs update
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shellInput.trim()) return;

    const cmd = shellInput.trim().toLowerCase();
    const timeStr = new Date().toTimeString().split(' ')[0];

    // Log the input
    setLogs(prev => [
      ...prev,
      { id: Math.random().toString(), module: 'SHELL_OPERATOR', level: 'INFO', message: `guest@quant-platform:~$ ${shellInput}`, timestamp: timeStr }
    ]);

    setShellInput('');

    setTimeout(() => {
      if (cmd === 'help') {
        const helpLines = [
          'Sentry CLI - Multi-Agent Algorithmic Router Engine',
          '  help               - Display operator reference documentation.',
          '  system info        - Print low-level client/engine telemetry.',
          '  clear              - Clear the terminal scrollback logs.',
          '  engine status      - Query multi-module connection states.',
          '  emergency flatten  - Execute immediate flatten positions sequence.'
        ];
        helpLines.forEach(h => {
          setLogs(prev => [...prev, { id: Math.random().toString(), module: 'SHELL_HELP', level: 'INFO', message: h, timestamp: timeStr }]);
        });
      } else if (cmd === 'clear') {
        setLogs([]);
      } else if (cmd === 'system info') {
        setLogs(prev => [
          ...prev,
          { id: Math.random().toString(), module: 'TELEMETRY', level: 'SUCCESS', message: '=== COGNITIVE TELEMETRY: Host active on Cloud Run workspace. Sandbox isolation mode: ARMED.', timestamp: timeStr }
        ]);
      } else if (cmd === 'engine status') {
        setLogs(prev => [
          ...prev,
          { id: Math.random().toString(), module: 'TELEMETRY', level: 'SUCCESS', message: 'ENGINES: [BinanceWS: UP] [RiskEngine: ARMED] [Portfolio: ALIVE] [AIEngine: ONLINE] [Strategy: LOADED]', timestamp: timeStr }
        ]);
      } else if (cmd.includes('flatten') || cmd.includes('emergency')) {
        eventBus.emit('risk:alert', { level: 'KILL_SWITCH', message: 'Manual operator emergency flatten invoked.' });
      } else {
        setLogs(prev => [
          ...prev,
          { id: Math.random().toString(), module: 'SHELL_ERROR', level: 'ERROR', message: `Unknown instruction: "${cmd}". Type "help" for operator commands.`, timestamp: timeStr }
        ]);
      }
    }, 150);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[380px] shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4.5 h-4.5 text-emerald-400" />
          <h2 className="font-semibold text-slate-100 text-sm">Operator System Log & Command Shell</h2>
        </div>
        <button
          onClick={() => setLogs([])}
          className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          Clear Shell
        </button>
      </div>

      {/* LOG DISPLAY AREA */}
      <div className="flex-1 bg-slate-950 rounded-lg p-3 font-mono text-xs overflow-y-auto mb-3 border border-slate-950 flex flex-col gap-1.5">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2.5 leading-relaxed items-start">
            <span className="text-slate-600 text-[10px] shrink-0 mt-0.5">[{log.timestamp}]</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
              log.level === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              log.level === 'WARN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              log.level === 'ERROR' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
              'bg-slate-800 text-slate-400'
            }`}>
              {log.module}
            </span>
            <span className={`break-all ${
              log.level === 'ERROR' ? 'text-rose-400' : 
              log.level === 'SUCCESS' ? 'text-emerald-300' :
              log.level === 'WARN' ? 'text-amber-300' : 'text-slate-300'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* INPUT CONTROL */}
      <form onSubmit={handleCommand} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2">
        <span className="text-emerald-400 font-mono text-xs pl-1 select-none font-semibold">$&gt;</span>
        <input
          type="text"
          value={shellInput}
          onChange={(e) => setShellInput(e.target.value)}
          placeholder="Type operator command (e.g. 'help', 'system info', 'engine status')..."
          className="flex-1 bg-transparent border-none text-xs font-mono text-slate-100 focus:outline-none placeholder:text-slate-600"
        />
        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 p-1.5 rounded transition border border-slate-800 cursor-pointer"
        >
          <Play className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
};
