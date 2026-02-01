'use client';

import { ChartControls } from '@/features/chart-control/ui/chart-control';
import { TradeForm } from '@/features/trade-stock/ui/trade-form';

import { StockChart } from '@/entities/stock/ui/stock-chart';

import { useDashboardLogic } from '../lib/use-dashboard-logic';
import { useDashboardStore } from '../model/dashborad-store';
import { PerformanceCard } from './performence-card';
import { DashboardHeader } from './stock-dashboard-header';

export const StockDashboardWidget = () => {
  // UI 상태
  const { symbol, setSymbol, indicators, toggleIndicator, strategyParams, setStrategyParam } =
    useDashboardStore();

  // 데이터 로직
  const { mergedData, backtestLine, companyName, markers, currentPrice, isLoading, refetch } =
    useDashboardLogic();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 p-4 text-slate-200">
      <div className="mb-4 shrink-0">
        {companyName ? (
          <DashboardHeader companyName={companyName} symbol={symbol} onSearch={setSymbol} />
        ) : (
          <div className="h-18 w-full animate-pulse rounded-xl bg-slate-900/50" />
        )}
      </div>

      <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden">
        <aside className="scrollbar-hide col-span-12 flex flex-col gap-4 overflow-y-auto pr-1 md:col-span-3 lg:col-span-3 xl:col-span-3">
          <PerformanceCard data={backtestLine} />

          <ChartControls
            options={indicators}
            params={strategyParams}
            onChange={toggleIndicator}
            onParamChange={setStrategyParam}
            onApply={refetch}
          />
        </aside>

        <main className="col-span-12 flex h-full flex-col gap-4 md:col-span-9 lg:col-span-9 xl:col-span-9">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            {isLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                <p className="animate-pulse font-medium text-emerald-500">Syncing Market Data...</p>
              </div>
            )}

            {mergedData.length > 0 ? (
              <StockChart
                data={mergedData}
                backtestData={backtestLine}
                visibleIndicators={indicators}
                markers={markers}
              />
            ) : (
              !isLoading && (
                <div className="flex h-full items-center justify-center text-slate-500">
                  Waiting for data...
                </div>
              )
            )}
          </div>

          <div className="shrink-0">
            <TradeForm symbol={symbol} currentPrice={currentPrice} onOrderPlaced={refetch} />
          </div>
        </main>
      </div>
    </div>
  );
};
