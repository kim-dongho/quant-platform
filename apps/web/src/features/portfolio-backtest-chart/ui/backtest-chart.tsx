'use client';

import { useEffect, useRef } from 'react';

import type { IChartApi, Time } from 'lightweight-charts';
import { ColorType, LineStyle, createChart } from 'lightweight-charts';

import type { PortfolioBacktestResult } from '@/entities/portfolio/model/types';

import { Spinner } from '@/shared/ui/spinner';

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
        title: result.benchmark_label ?? '벤치마크',
      });
      benchSeries.setData(result.benchmark.map((p) => ({ time: p.time as Time, value: p.value })));
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
    <div className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-on-surface text-[15px] font-semibold">누적 수익률</h2>
          <p className="text-on-surface-variant text-[11px]">
            이 조건대로 매일 종목을 바꿔가며 운용했다면 자산이 어떻게 변했을지 · 점선은
            벤치마크(지수 ETF)
          </p>
        </div>
        {result && (
          <span className="text-on-surface-variant shrink-0 text-[11px]">
            {result.start_date} → {result.end_date}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="text-on-surface-variant flex h-[420px] flex-col items-center justify-center gap-3 text-xs">
          <Spinner size={32} />
          <span>시뮬레이션 계산 중… (수 초 소요)</span>
        </div>
      )}

      {!isLoading && !result && (
        <div className="border-outline-variant/40 text-on-surface-variant flex h-[420px] items-center justify-center rounded-md border border-dashed text-xs">
          시뮬레이션 실행 버튼을 누르면 과거 성과가 표시됩니다
        </div>
      )}

      {!isLoading && result && result.equity.length > 0 && (
        <div ref={containerRef} className="min-h-[320px] w-full flex-1" />
      )}

      {!isLoading && result && result.equity.length === 0 && (
        <div className="border-outline-variant/40 text-on-surface-variant flex h-[420px] items-center justify-center rounded-md border border-dashed text-center text-xs">
          {result.note ?? '데이터가 부족합니다'}
        </div>
      )}
    </div>
  );
};
