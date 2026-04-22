'use client';

import { useEffect, useState } from 'react';

import { ChartControls } from '@/features/chart-control/ui/chart-control';
import { IndicatorSelector } from '@/features/chart-control/ui/indicator-selector';
import { StockSearch } from '@/features/stock-search/ui/stock-search';
import { TradeForm } from '@/features/trade-stock/ui/trade-form';

import { StockChart } from '@/entities/stock/ui/stock-chart';

import { StockLogo } from '@/shared/ui/stock-logo';

import { DashboardMode, useDashboardLogic } from '../lib/use-dashboard-logic';
import { useDashboardUrlSync } from '../lib/use-url-sync';
import { StrategyParams, useDashboardStore } from '../model/dashborad-store';
import { PerformanceCard } from './performence-card';
import { StrategyList } from './strategy-list';

interface Props {
  mode: DashboardMode;
}

export const StockDashboardWidget = ({ mode }: Props) => {
  useDashboardUrlSync();

  const { symbol, setSymbol, indicators, toggleIndicator, strategyParams, setStrategyParam } =
    useDashboardStore();

  const {
    mergedData,
    backtestLine,
    companyName,
    markers,
    currentPrice,
    isLoading,
    refetch,
    trades,
    winRate,
  } = useDashboardLogic(mode);

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
      <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
          <StockLogo symbol={symbol} size={36} />
          <div className="flex items-baseline gap-2">
            <span className="text-[18px] font-semibold text-on-surface">
              {companyName || symbol}
            </span>
            {companyName && companyName !== symbol && (
              <span className="text-[13px] text-on-surface-variant">{symbol}</span>
            )}
          </div>
          <span className="rounded-md border border-outline-variant/40 px-2 py-0.5 text-xs text-on-surface-variant">
            {mode === 'trade' ? '1m' : '1D'}
          </span>
          <div className="ml-auto w-full max-w-xs">
            <StockSearch onSearch={setSymbol} currentSymbol={symbol} />
          </div>
          {mode === 'backtest' && (
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">
                {sidebarOpen ? 'right_panel_close' : 'right_panel_open'}
              </span>
            </button>
          )}
        </div>

        <IndicatorSelector options={indicators} onChange={toggleIndicator} />

        <div className="relative flex flex-1 flex-col overflow-hidden p-4">
          <div className="relative w-full flex-1 overflow-hidden rounded-xl border border-outline-variant/20 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            {isLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface/60 backdrop-blur-[2px]">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm font-medium text-primary">Syncing Market Data...</p>
              </div>
            )}

            {hasData ? (
              <div className="h-full w-full">
                <StockChart
                  data={mergedData}
                  backtestData={backtestLine}
                  visibleIndicators={indicators}
                  markers={markers}
                />
              </div>
            ) : (
              !isLoading && (
                <div className="flex h-full items-center justify-center text-on-surface-variant">
                  Waiting for data...
                </div>
              )
            )}
          </div>
        </div>

        {mode === 'trade' && (
          <TradeForm symbol={symbol} currentPrice={currentPrice} onOrderPlaced={refetch} />
        )}
      </div>

      {/* Right Sidebar: Strategy & Settings (Backtest 모드 전용) */}
      {mode === 'backtest' && (
      <aside
        className={`z-10 flex h-full shrink-0 flex-col overflow-hidden border-l border-outline-variant/30 bg-surface-container-lowest shadow-[-4px_0_24px_rgba(0,0,0,0.02)] transition-[width] duration-300 ease-in-out ${
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

          <div className="sticky bottom-0 mt-auto border-t border-outline-variant/30 bg-surface-container-lowest/90 p-4 backdrop-blur">
            <button
              onClick={runBacktest}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all hover:bg-on-primary-fixed-variant"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              Run Backtest
            </button>
          </div>
        </div>
      </aside>
      )}
    </div>
  );
};
