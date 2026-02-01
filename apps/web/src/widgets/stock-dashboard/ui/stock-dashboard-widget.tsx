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
    <div className="min-h-screen space-y-4 bg-slate-950 p-6">
      {/* 헤더 섹션 */}
      <DashboardHeader companyName={companyName} symbol={symbol} onSearch={setSymbol} />

      {/* 컨트롤 패널 */}
      <ChartControls
        options={indicators}
        params={strategyParams}
        onChange={toggleIndicator}
        onParamChange={setStrategyParam}
        onApply={refetch}
      />

      {/* 메인 차트 영역 */}
      <div className="relative min-h-150 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
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
            <div className="flex h-full items-center justify-center text-slate-500">No Data</div>
          )
        )}
      </div>

      {/* 하단 패널 (매매 폼 & 성과 카드) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <TradeForm symbol={symbol} currentPrice={currentPrice} onOrderPlaced={refetch} />
        </div>
        <PerformanceCard data={backtestLine} />
      </div>
    </div>
  );
};
