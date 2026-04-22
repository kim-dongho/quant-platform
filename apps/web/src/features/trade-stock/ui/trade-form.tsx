'use client';

import { useState } from 'react';

import { OrderSide } from '@/entities/order/model/types';

interface Props {
  symbol: string;
  currentPrice: number;
  onOrderPlaced: () => void;
}

export const TradeForm = ({ symbol, currentPrice }: Props) => {
  const [quantity, setQuantity] = useState(1.5);
  const [isSubmitting] = useState(false);

  const handleTrade = (_side: OrderSide) => {
    if (quantity <= 0) return;
  };

  return (
    <div className="flex h-20 shrink-0 items-center gap-6 border-t border-outline-variant/30 bg-surface-container-lowest px-4 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
          Current Price
        </span>
        <span className="font-mono text-[24px] leading-tight font-semibold tracking-tight text-on-surface tabular-nums">
          {currentPrice > 0 ? currentPrice.toFixed(2) : '--'}{' '}
          <span className="text-sm text-secondary">USD</span>
        </span>
      </div>

      <div className="hidden h-10 w-px bg-outline-variant/30 sm:block" />

      <div className="flex flex-1 items-center gap-4">
        <div className="flex max-w-[200px] flex-1 flex-col">
          <label className="mb-1 text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
            Quantity
          </label>
          <div className="relative">
            <input
              type="number"
              value={quantity}
              min={0}
              step="0.1"
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-md border border-outline-variant/50 bg-surface py-2 pr-12 pl-3 font-mono text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
              {symbol || 'USD'}
            </span>
          </div>
        </div>

        <div className="ml-auto flex gap-2 sm:ml-0">
          <button
            onClick={() => handleTrade('BUY')}
            disabled={isSubmitting}
            className="min-w-[120px] rounded-lg bg-secondary px-8 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(0,108,73,0.2)] transition-all hover:bg-secondary/90 disabled:opacity-50"
          >
            BUY
          </button>
          <button
            onClick={() => handleTrade('SELL')}
            disabled={isSubmitting}
            className="min-w-[120px] rounded-lg bg-error px-8 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(186,26,26,0.2)] transition-all hover:bg-error/90 disabled:opacity-50"
          >
            SELL
          </button>
        </div>
      </div>
    </div>
  );
};
