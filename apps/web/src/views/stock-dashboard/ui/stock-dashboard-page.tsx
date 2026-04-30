'use client';

import { StockSearch } from '@/features/stock-search/ui/stock-search';

import { StockChart } from '@/entities/stock/ui/stock-chart';

import { PageHeader } from '@/shared/ui/page-header';
import { StockLogo } from '@/shared/ui/stock-logo';

import { useDashboardLogic } from '../lib/use-dashboard-logic';
import { useSymbolUrlSync } from '../lib/use-symbol-url-sync';
import { useDashboardStore } from '../model/dashboard-store';

// /backtest = 단순 차트 뷰어. 종목 검색 + 일봉 차트만 제공.
// 전략 설계·백테스트는 /portfolio, 라이브 운영은 /live.
export const StockDashboardPage = () => {
  useSymbolUrlSync();

  const { symbol, setSymbol } = useDashboardStore();
  const { mergedData, companyName, isLoading } = useDashboardLogic();

  const hasData = mergedData.length > 0;

  return (
    <div className="bg-background flex h-full flex-1 flex-col overflow-hidden">
      <PageHeader
        leading={<StockLogo symbol={symbol} size={36} />}
        title={
          <>
            <span>{companyName || symbol}</span>
            {companyName && companyName !== symbol && (
              <span className="text-on-surface-variant text-[14px] font-normal">{symbol}</span>
            )}
          </>
        }
        subtitle={
          <span className="border-outline-variant/40 inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
            1D
          </span>
        }
        actions={
          <div className="w-full max-w-xs">
            <StockSearch onSearch={setSymbol} currentSymbol={symbol} />
          </div>
        }
      />

      <div className="relative flex flex-1 flex-col overflow-hidden p-4">
        <div className="border-outline-variant/20 relative w-full flex-1 overflow-hidden rounded-xl border bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          {isLoading && (
            <div className="bg-surface/60 absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-[2px]">
              <div className="border-primary mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-primary text-sm font-medium">Loading chart...</p>
            </div>
          )}

          {hasData ? (
            <div className="h-full w-full">
              <StockChart
                data={mergedData}
                visibleIndicators={{
                  sma: false,
                  rsi: false,
                  macd: false,
                  bollinger: false,
                  volume: false,
                }}
                symbol={symbol}
              />
            </div>
          ) : (
            !isLoading && (
              <div className="text-on-surface-variant flex h-full items-center justify-center">
                종목을 검색해주세요
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
