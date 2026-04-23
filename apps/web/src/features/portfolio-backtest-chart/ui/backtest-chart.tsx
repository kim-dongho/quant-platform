'use client';

import { useEffect, useRef } from 'react';

import { ColorType, IChartApi, LineStyle, Time, createChart } from 'lightweight-charts';

import type { PortfolioBacktestResult } from '@/entities/portfolio/model/types';

interface Props {
  result: PortfolioBacktestResult | null;
  isLoading: boolean;
}

export const BacktestChart = ({ result, isLoading }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !result || result.equity.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#434655',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#eef2ff' },
        horzLines: { color: '#eef2ff' },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 360,
      rightPriceScale: { borderColor: '#c3c6d7' },
      timeScale: { borderColor: '#c3c6d7', barSpacing: 4 },
    });
    chartRef.current = chart;

    const portfolioSeries = chart.addLineSeries({
      color: '#004ac6',
      lineWidth: 2,
      title: 'Portfolio',
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
      const benchSeries = chart.addLineSeries({
        color: '#64748b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'SPY',
      });
      benchSeries.setData(
        result.benchmark.map((p) => ({ time: p.time as Time, value: p.value })),
      );
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [result]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">Portfolio Growth</h2>
          <p className="text-[11px] text-on-surface-variant">
            이 룰로 매일 스크리닝 + 리밸런싱한 과거 성과 · SPY 벤치마크 비교
          </p>
        </div>
        {result && (
          <span className="shrink-0 text-[11px] text-on-surface-variant">
            {result.start_date} → {result.end_date}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex h-[360px] items-center justify-center text-xs text-on-surface-variant">
          Running backtest... (수 초 소요)
        </div>
      )}

      {!isLoading && !result && (
        <div className="flex h-[360px] items-center justify-center rounded-md border border-dashed border-outline-variant/40 text-xs text-on-surface-variant">
          Run Simulation으로 포트폴리오 성과를 확인하세요
        </div>
      )}

      {!isLoading && result && result.equity.length > 0 && (
        <div ref={containerRef} className="h-[360px] w-full" />
      )}

      {!isLoading && result && result.equity.length === 0 && (
        <div className="flex h-[360px] items-center justify-center rounded-md border border-dashed border-outline-variant/40 text-center text-xs text-on-surface-variant">
          {result.note ?? '데이터가 부족합니다'}
        </div>
      )}
    </div>
  );
};
