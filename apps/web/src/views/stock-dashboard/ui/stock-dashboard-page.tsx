'use client';

import { useMemo, useState } from 'react';

import { StockSearch } from '@/features/stock-search/ui/stock-search';

import type { Timeframe } from '@/entities/stock/api/stocks-api';
import { analyzeChart } from '@/entities/stock/lib/analysis';
import { StockChart } from '@/entities/stock/ui/stock-chart';

import { PageHeader } from '@/shared/ui/page-header';
import { StockLogo } from '@/shared/ui/stock-logo';

import { useDashboardLogic } from '../lib/use-dashboard-logic';
import { useSymbolUrlSync } from '../lib/use-symbol-url-sync';
import { useDashboardStore } from '../model/dashboard-store';
import { AnalysisModal } from './analysis-modal';
import { ChartChannelToggles } from './chart-channel-toggles';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1d', label: '1D' },
  { key: '4h', label: '4H' },
  { key: '1h', label: '1H' },
];

// /backtest = 단순 차트 뷰어. 종목 검색 + 일봉/시간봉 차트 + 채널 토글.
// 전략 설계·백테스트는 /portfolio, 라이브 운영은 /live.
export const StockDashboardPage = () => {
  useSymbolUrlSync();

  const symbol = useDashboardStore((s) => s.symbol);
  const setSymbol = useDashboardStore((s) => s.setSymbol);
  const timeframe = useDashboardStore((s) => s.timeframe);
  const setTimeframe = useDashboardStore((s) => s.setTimeframe);
  const channels = useDashboardStore((s) => s.channels);
  const { mergedData, companyName, isLoading } = useDashboardLogic();

  const hasData = mergedData.length > 0;

  const [analysisOpen, setAnalysisOpen] = useState(false);
  // 분석 결과는 modal 이 열릴 때 계산 — 닫혀있을 땐 비용 0.
  const analysis = useMemo(
    () => (analysisOpen && hasData ? analyzeChart(mergedData) : null),
    [analysisOpen, mergedData, hasData],
  );

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
          <div className="border-outline-variant/40 inline-flex items-center gap-1 rounded-md border p-0.5">
            {TIMEFRAMES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTimeframe(key)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  timeframe === key
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-variant/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAnalysisOpen(true)}
              disabled={!hasData}
              className="border-outline-variant/40 text-on-surface hover:bg-surface-variant/40 disabled:text-on-surface-variant/40 inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">analytics</span>
              분석
            </button>
            <div className="w-full max-w-xs">
              <StockSearch onSearch={setSymbol} currentSymbol={symbol} />
            </div>
          </div>
        }
      />

      <AnalysisModal
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        analysis={analysis}
        symbol={symbol}
        companyName={companyName}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden p-4">
        <ChartChannelToggles />

        <div className="border-outline-variant/20 relative mt-2 w-full flex-1 overflow-hidden rounded-xl border bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
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
                  ...channels,
                }}
                symbol={symbol}
                timeframe={timeframe}
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
