import React, { useState, useEffect } from 'react';
import { Play, Clipboard, Layers, CheckCircle } from 'lucide-react';
import { BinanceConnector } from '../exchange/BinanceConnector';
import { OrderBook, Order, OrderType, TimeInForce } from '../types/trading';
import { EventBus } from '../core/EventBus';

export const OrderBookTerminal: React.FC = () => {
  const connector = BinanceConnector.getInstance();
  const eventBus = EventBus.getInstance();

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [orderbook, setOrderbook] = useState<OrderBook | null>(connector.getOrderBook(symbol));
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  // Form Fields
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [price, setPrice] = useState('92450.0');
  const [quantity, setQuantity] = useState('0.05');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('GTC');
  const [stopPrice, setStopPrice] = useState('');
  const [icebergQty, setIcebergQty] = useState('');

  useEffect(() => {
    // Listen for orderbook updates
    const handleOBUpdate = (payload: { symbol: string }) => {
      if (payload.symbol === symbol) {
        setOrderbook(connector.getOrderBook(symbol));
      }
    };

    // Listen for order updates
    const handleOrderCreated = (order: Order) => {
      setActiveOrders(prev => [order, ...prev]);
    };

    const handleOrderFilled = (filledOrder: Order) => {
      setActiveOrders(prev => prev.map(o => o.id === filledOrder.id ? filledOrder : o));
    };

    eventBus.on('orderbook:update', handleOBUpdate);
    eventBus.on('order:created', handleOrderCreated);
    eventBus.on('order:filled', handleOrderFilled);

    return () => {
      eventBus.off('orderbook:update', handleOBUpdate);
      eventBus.off('order:created', handleOrderCreated);
      eventBus.off('order:filled', handleOrderFilled);
    };
  }, [symbol]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await connector.createOrder({
        symbol,
        type: orderType,
        side,
        price: orderType === 'MARKET' ? undefined : parseFloat(price),
        quantity: parseFloat(quantity) || 0,
        timeInForce,
        stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
        icebergQty: icebergQty ? parseFloat(icebergQty) : undefined
      });
    } catch (err: any) {
      alert(`Order Router Exception: ${err.message}`);
    }
  };

  const handleCancelOrder = (id: string) => {
    setActiveOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELED' as const } : o));
    eventBus.emit('system:log', {
      module: 'ORDER_ENGINE',
      level: 'WARN',
      message: `Order [${id}] cancelled by operator.`
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Layers className="w-4.5 h-4.5 text-emerald-400" />
        <h2 className="font-semibold text-slate-100 text-sm">Execution Matching Terminal</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* COLUMN 1: LIVE ORDERBOOK FEED (4/12 width) */}
        <div className="md:col-span-4 flex flex-col gap-2 bg-slate-950 p-3 rounded-lg border border-slate-850">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-slate-500 pb-2 border-b border-slate-900">
            <span>Price (USDT)</span>
            <span>Qty ({symbol.replace('USDT', '')})</span>
          </div>

          {/* ASKS (Sells) in reverse order */}
          <div className="flex flex-col-reverse gap-0.5">
            {orderbook?.asks.slice(0, 5).map((ask, idx) => (
              <div key={idx} className="flex justify-between font-mono text-[11px] text-rose-400 hover:bg-rose-500/5 transition py-0.5 px-1 rounded">
                <span>{ask.price.toFixed(2)}</span>
                <span>{ask.quantity.toFixed(3)}</span>
              </div>
            ))}
          </div>

          {/* SPREAD LEVEL */}
          <div className="text-center font-bold text-xs py-1.5 border-y border-slate-900 text-slate-200 bg-slate-900/30">
            SPREAD REF: {((orderbook?.asks[0]?.price || 0) - (orderbook?.bids[0]?.price || 0)).toFixed(2)}
          </div>

          {/* BIDS (Buys) */}
          <div className="flex flex-col gap-0.5">
            {orderbook?.bids.slice(0, 5).map((bid, idx) => (
              <div key={idx} className="flex justify-between font-mono text-[11px] text-emerald-400 hover:bg-emerald-500/5 transition py-0.5 px-1 rounded">
                <span>{bid.price.toFixed(2)}</span>
                <span>{bid.quantity.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: EXECUTION INPUT FORM (8/12 width) */}
        <form onSubmit={handleSubmitOrder} className="md:col-span-8 flex flex-col gap-3">
          
          {/* BUY/SELL SIDE SWITCH */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setSide('BUY')}
              className={`flex-1 text-center py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                side === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              BUY / LONG
            </button>
            <button
              type="button"
              onClick={() => setSide('SELL')}
              className={`flex-1 text-center py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                side === 'SELL' ? 'bg-rose-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SELL / SHORT
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-slate-500 uppercase">Order Routing Type:</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="LIMIT">LIMIT</option>
                <option value="MARKET">MARKET</option>
                <option value="STOP_LIMIT">STOP LIMIT</option>
                <option value="ICEBERG">ICEBERG</option>
                <option value="TWAP">TWAP ROUTER</option>
                <option value="VWAP">VWAP ROUTER</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-slate-500 uppercase">Time In Force:</label>
              <select
                value={timeInForce}
                onChange={(e) => setTimeInForce(e.target.value as TimeInForce)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="GTC">GTC (Good Till Cancel)</option>
                <option value="IOC">IOC (Immediate Or Cancel)</option>
                <option value="FOK">FOK (Fill Or Kill)</option>
                <option value="POST_ONLY">POST ONLY</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {orderType !== 'MARKET' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-slate-500 uppercase">Limit Price (USDT):</label>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-slate-500 uppercase">Order Quantity ({symbol.replace('USDT', '')}):</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* ADVANCED ROUTING FIELD ACCORDION */}
          {(orderType === 'STOP_LIMIT' || orderType === 'ICEBERG') && (
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-2.5 rounded border border-slate-850">
              {orderType === 'STOP_LIMIT' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-slate-500 uppercase">Stop Price:</label>
                  <input
                    type="text"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    placeholder="Trigger reference"
                    className="bg-slate-900 border border-slate-800 rounded p-1 text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                </div>
              )}
              {orderType === 'ICEBERG' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-slate-500 uppercase">Iceberg Chunk Size:</label>
                  <input
                    type="text"
                    value={icebergQty}
                    onChange={(e) => setIcebergQty(e.target.value)}
                    placeholder="Show size fraction"
                    className="bg-slate-900 border border-slate-800 rounded p-1 text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className={`font-bold py-2 px-4 rounded-lg text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
              side === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-rose-500 hover:bg-rose-400 text-slate-950'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            ROUTING INSTITUTIONAL ORDER
          </button>
        </form>
      </div>

      {/* ACTIVE RUNNING ORDERS TRACKING TABLE */}
      <div className="mt-2.5 pt-3.5 border-t border-slate-800">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-2">
          Operator Order Flow Blotter
        </span>
        <div className="bg-slate-950 rounded-lg border border-slate-850 overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-400 font-mono">
                <th className="p-2">ID</th>
                <th className="p-2">Side</th>
                <th className="p-2">Type</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Filled</th>
                <th className="p-2">Price</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-600 font-mono">
                    No active orders placed in current session blotter.
                  </td>
                </tr>
              ) : (
                activeOrders.map(order => (
                  <tr key={order.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-2 font-mono text-[10px] text-slate-500">{order.id}</td>
                    <td className={`p-2 font-bold ${order.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {order.side}
                    </td>
                    <td className="p-2 text-[10px] font-mono text-slate-400">{order.type}</td>
                    <td className="p-2 font-mono">{order.quantity}</td>
                    <td className="p-2 font-mono">{order.executedQty}</td>
                    <td className="p-2 font-mono">${order.price?.toFixed(2) || 'MARKET'}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        order.status === 'FILLED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        order.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
