'use client';

import { useEffect, useRef } from 'react';

import type { IChartApi, Time } from 'lightweight-charts';
import { ColorType, LineSeries, LineStyle, createChart } from 'lightweight-charts';

import type { FactorPortfolioResult } from '@/entities/factor-portfolio/model/types';

import { Spinner } from '@/shared/ui/spinner';

interface Props {
  result: FactorPortfolioResult | null;
  isLoading: boolean;
}

export const FactorChart = ({ result, isLoading }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !result || result.equity.length === 0) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#434655',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#eef2ff' },
        horzLines: { color: '#eef2ff' },
      },
      rightPriceScale: { borderColor: '#c3c6d7' },
      timeScale: { borderColor: '#c3c6d7', barSpacing: 4 },
    });
    chartRef.current = chart;

    const portfolioSeries = chart.addSeries(LineSeries, {
      color: '#004ac6',
      lineWidth: 2,
      title: 'Factor Portfolio',
    });
    portfolioSeries.setData(result.equity.map((p) => ({ time: p.time as Time, value: p.value })));
    portfolioSeries.createPriceLine({
      price: 1.0,
      color: '#94a3b8',
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Start',
    });

    if (result.benchmark.length > 0) {
      const benchSeries = chart.addSeries(LineSeries, {
        color: '#64748b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: result.benchmark_label ?? '벤치마크',
      });
      benchSeries.setData(result.benchmark.map((p) => ({ time: p.time as Time, value: p.value })));
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [result]);

  const showChart = !isLoading && result && result.equity.length > 0;
  const overlayMessage = isLoading
    ? null
    : !result
      ? '백테스트 실행 버튼을 누르면 누적 수익률이 표시됩니다'
      : result.equity.length === 0
        ? (result.note ?? '데이터가 부족합니다')
        : null;

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-on-surface text-[15px] font-semibold">누적 수익률</h2>
          <p className="text-on-surface-variant text-[11px]">
            점수 top {result ? Math.round(result.top_pct * 100) : 20}% 종목을{' '}
            {result?.rebalance_months ?? 3}개월마다 동일가중 매수 · 점선은 벤치마크 (지수 ETF)
          </p>
        </div>
        {result && (
          <span className="text-on-surface-variant shrink-0 text-[11px]">
            {result.start_date} → {result.end_date}
          </span>
        )}
      </div>

      <div className="relative h-[360px] w-full">
        <div ref={containerRef} className={`h-full w-full ${showChart ? '' : 'invisible'}`} />
        {isLoading && (
          <div className="text-on-surface-variant absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs">
            <Spinner size={32} />
            <span>백테스트 계산 중…</span>
          </div>
        )}
        {overlayMessage && (
          <div className="border-outline-variant/40 text-on-surface-variant absolute inset-0 flex items-center justify-center rounded-md border border-dashed text-center text-xs">
            {overlayMessage}
          </div>
        )}
      </div>
    </div>
  );
};
