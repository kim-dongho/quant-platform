'use client';

import { useState } from 'react';

import { PaperAccountCard } from '@/features/paper-account/ui/paper-account-card';
import { OrderHistory } from '@/features/paper-orders/ui/order-history';
import { StockSearch } from '@/features/stock-search/ui/stock-search';
import { TradeForm } from '@/features/trade-stock/ui/trade-form';

// KIS 모의투자는 국내 종목만 지원 — 기본값 삼성전자
const DEFAULT_SYMBOL = '005930.KS';

export const TradeDashboardWidget = () => {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);

  return (
    <div className="bg-background flex h-full flex-1 flex-col overflow-hidden">
      <header className="border-outline-variant/30 bg-surface-container-lowest flex items-center gap-3 border-b px-4 py-3">
        <span className="material-symbols-outlined text-primary text-[22px]">
          account_balance_wallet
        </span>
        <span className="text-on-surface text-[18px] font-semibold">Paper Trading</span>
        <span className="border-outline-variant/40 text-on-surface-variant rounded-md border px-2 py-0.5 text-xs">
          KIS 모의투자
        </span>
        <div className="ml-auto w-full max-w-xs">
          <StockSearch onSearch={setSymbol} currentSymbol={symbol} />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <PaperAccountCard />
        <OrderHistory />
      </div>

      <TradeForm symbol={symbol} />
    </div>
  );
};
