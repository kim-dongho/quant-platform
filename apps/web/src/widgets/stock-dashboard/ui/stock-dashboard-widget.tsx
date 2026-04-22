'use client';

import { useEffect, useMemo, useState } from 'react';

import { ChartControls } from '@/features/chart-control/ui/chart-control';
import { IndicatorSelector } from '@/features/chart-control/ui/indicator-selector';
import { StockSearch } from '@/features/stock-search/ui/stock-search';
import { TradeForm } from '@/features/trade-stock/ui/trade-form';

import { StockChart } from '@/entities/stock/ui/stock-chart';

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

  const { mergedData, backtestLine, companyName, markers, currentPrice, isLoading, refetch } =
    useDashboardLogic(mode);

  // Draft 파라미터: Run Backtest 누르기 전까지 store에 commit되지 않음.
  // store가 바뀌면(URL hydration 등) draft도 동기화.
  const [draftParams, setDraftParams] = useState<StrategyParams>(strategyParams);
  useEffect(() => {
    setDraftParams(strategyParams);
  }, [strategyParams]);

  const hasData = mergedData.length > 0;

  const ohlc = useMemo(() => {
    if (!hasData) return null;
    const last = mergedData[mergedData.length - 1];
    return {
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    };
  }, [mergedData, hasData]);

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
      {/* Left Sidebar: Strategy & Settings */}
      <div className="z-10 flex h-full w-full shrink-0 flex-col overflow-y-auto border-r border-outline-variant/30 bg-surface-container-lowest shadow-[4px_0_24px_rgba(0,0,0,0.02)] md:w-[320px] lg:w-[360px]">
        <div className="flex flex-col gap-6 p-4">
          <StockSearch onSearch={setSymbol} currentSymbol={symbol} />

          <PerformanceCard data={backtestLine} />

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

      {/* Center Chart Area */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
        <IndicatorSelector options={indicators} onChange={toggleIndicator} />

        <div className="relative flex flex-1 flex-col overflow-hidden p-4">
          {/* Info Overlay */}
          <div className="pointer-events-none absolute top-6 left-6 z-10 flex flex-col gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest/80 p-3 shadow-sm backdrop-blur">
            <div className="flex items-baseline gap-2">
              <span className="text-[18px] leading-7 font-semibold text-on-surface">
                {companyName || symbol}
              </span>
              <span className="text-[13px] text-on-surface-variant">
                {mode === 'trade' ? '1m' : '1D'}
              </span>
            </div>
            {ohlc && (
              <div className="flex items-baseline gap-3 font-mono text-xs tabular-nums">
                <span className="text-secondary">O: {ohlc.open.toFixed(2)}</span>
                <span className="text-secondary">H: {ohlc.high.toFixed(2)}</span>
                <span className="text-error">L: {ohlc.low.toFixed(2)}</span>
                <span className="text-on-surface">C: {ohlc.close.toFixed(2)}</span>
              </div>
            )}
          </div>

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
    </div>
  );
};
