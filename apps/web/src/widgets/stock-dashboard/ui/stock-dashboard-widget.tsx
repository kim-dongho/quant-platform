'use client';

import { useEffect, useState } from 'react';

import { ChartControls } from '@/features/chart-control/ui/chart-control';
import { IndicatorSelector } from '@/features/chart-control/ui/indicator-selector';
import { StockSearch } from '@/features/stock-search/ui/stock-search';

import { StockChart } from '@/entities/stock/ui/stock-chart';

import { StockLogo } from '@/shared/ui/stock-logo';

import { useDashboardLogic } from '../lib/use-dashboard-logic';
import { useDashboardUrlSync } from '../lib/use-url-sync';
import { StrategyParams, useDashboardStore } from '../model/dashborad-store';
import { PerformanceCard } from './performence-card';
import { StrategyList } from './strategy-list';

export const StockDashboardWidget = () => {
  useDashboardUrlSync();

  const { symbol, setSymbol, indicators, toggleIndicator, strategyParams, setStrategyParam } =
    useDashboardStore();

  const { mergedData, backtestLine, companyName, markers, isLoading, refetch, trades, winRate } =
    useDashboardLogic();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Draft 파라미터: Run Backtest 누르기 전까지 store에 commit되지 않음.
  // store가 바뀌면(URL hydration 등) draft도 동기화.
  const [draftParams, setDraftParams] = useState<StrategyParams>(strategyParams);
  useEffect(() => {
    setDraftParams(strategyParams);
  }, [strategyParams]);

  const hasData = mergedData.length > 0;

  const updateDraftParam = (key: keyof StrategyParams, value: number | boolean) => {
    setDraftParams((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (config: Partial<StrategyParams>) => {
    setDraftParams((prev) => ({ ...prev, ...config }));
  };

  const runBacktest = () => {
    (Object.entries(draftParams) as [keyof StrategyParams, number | boolean][]).forEach(
      ([key, value]) => setStrategyParam(key, value),
    );
    refetch();
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden md:flex-row">
      {/* Center Chart Area */}
      <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
        <div className="border-outline-variant/30 bg-surface-container-lowest flex items-center gap-3 border-b px-4 py-3">
          <StockLogo symbol={symbol} size={36} />
          <div className="flex items-baseline gap-2">
            <span className="text-on-surface text-[18px] font-semibold">
              {companyName || symbol}
            </span>
            {companyName && companyName !== symbol && (
              <span className="text-on-surface-variant text-[13px]">{symbol}</span>
            )}
          </div>
          <span className="border-outline-variant/40 text-on-surface-variant rounded-md border px-2 py-0.5 text-xs">
            1D
          </span>
          <div className="ml-auto w-full max-w-xs">
            <StockSearch onSearch={setSymbol} currentSymbol={symbol} />
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              {sidebarOpen ? 'right_panel_close' : 'right_panel_open'}
            </span>
          </button>
        </div>

        <IndicatorSelector options={indicators} onChange={toggleIndicator} />

        <div className="relative flex flex-1 flex-col overflow-hidden p-4">
          <div className="border-outline-variant/20 relative w-full flex-1 overflow-hidden rounded-xl border bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            {isLoading && (
              <div className="bg-surface/60 absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-[2px]">
                <div className="border-primary mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
                <p className="text-primary text-sm font-medium">Syncing Market Data...</p>
              </div>
            )}

            {hasData ? (
              <div className="h-full w-full">
                <StockChart
                  data={mergedData}
                  backtestData={backtestLine}
                  visibleIndicators={indicators}
                  markers={markers}
                  symbol={symbol}
                />
              </div>
            ) : (
              !isLoading && (
                <div className="text-on-surface-variant flex h-full items-center justify-center">
                  Waiting for data...
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar: Strategy & Settings */}
      <aside
        className={`border-outline-variant/30 bg-surface-container-lowest z-10 flex h-full shrink-0 flex-col overflow-hidden border-l shadow-[-4px_0_24px_rgba(0,0,0,0.02)] transition-[width] duration-300 ease-in-out ${
          sidebarOpen ? 'w-full md:w-[320px] lg:w-[360px]' : 'w-0 border-l-0'
        }`}
      >
        <div className="flex h-full w-full flex-col overflow-y-auto md:w-[320px] lg:w-[360px]">
          <div className="flex flex-col gap-6 p-4">
            <PerformanceCard data={backtestLine} winRate={winRate} trades={trades} />

            <hr className="border-outline-variant/40" />

            <StrategyList params={draftParams} onSelect={applyPreset} />

            <hr className="border-outline-variant/40" />

            <ChartControls params={draftParams} onParamChange={updateDraftParam} />
          </div>

          <div className="border-outline-variant/30 bg-surface-container-lowest/90 sticky bottom-0 mt-auto border-t p-4 backdrop-blur">
            <button
              onClick={runBacktest}
              className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              Run Backtest
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
