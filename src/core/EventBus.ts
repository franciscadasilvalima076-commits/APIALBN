import { Order, Position, QuantitativeSignal, AIEnsembleReport } from '../types/trading';

type EventMap = {
  'market:tick': { symbol: string; price: number; timestamp: number };
  'orderbook:update': { symbol: string; sequence: number };
  'order:created': Order;
  'order:filled': Order;
  'position:update': Position;
  'signal:generated': QuantitativeSignal;
  'ai:ensemble': AIEnsembleReport;
  'risk:alert': { level: 'INFO' | 'WARNING' | 'CRITICAL' | 'KILL_SWITCH'; message: string };
  'system:log': { module: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'; message: string };
  'portfolio:rankings': any[];
  'portfolio:correlation': Record<string, Record<string, number>>;
  'portfolio:bots': any[];
};

export class EventBus {
  private static instance: EventBus;
  private listeners: { [key: string]: Array<(payload: any) => void> } = {};

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  public off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  public emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const list = this.listeners[event];
    if (list) {
      list.forEach(listener => {
        try {
          listener(payload);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }
}
