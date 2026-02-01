'use client';

import { useEffect, useRef } from 'react';

import { ColorType, IChartApi, LineStyle, SeriesMarker, createChart } from 'lightweight-charts';

import { calculateMACD, calculateRSI, calculateSMA } from '../lib/indicators';
import { ChartOptions, MarketData } from '../model/stocks-common';

interface Props {
  data: MarketData[];
  backtestData?: { time: string; value: number }[];
  markers?: SeriesMarker<string>[];
  visibleIndicators: ChartOptions;
}

export const StockChart = ({ data, backtestData = [], markers = [], visibleIndicators }: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // 1. 차트 초기화 (높이를 700으로 늘려 하단 지표 공간 확보)
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: chartContainerRef.current.clientWidth,
      height: 700, // 스택 구조를 위해 높이 증가
      leftPriceScale: {
        visible: backtestData.length > 0,
        borderColor: '#334155',
        scaleMargins: { top: 0.1, bottom: 0.7 }, // 상단 20% 영역에 수익률 곡선 배치
      },
      rightPriceScale: {
        visible: true,
        borderColor: '#334155',
        scaleMargins: { top: 0.1, bottom: 0.4 }, // 메인 캔들 영역은 상단 60% 사용
      },
      timeScale: { borderColor: '#334155', barSpacing: 12 },
    });
    chartRef.current = chart;

    // --- 2. 전략 수익률 곡선 (Left Axis) ---
    if (backtestData.length > 0) {
      const strategySeries = chart.addLineSeries({
        color: '#fbbf24', // amber-400 (가독성을 위해 색상 변경)
        lineWidth: 2,
        priceScaleId: 'left',
        title: 'Equity',
      });
      strategySeries.setData(backtestData);

      strategySeries.createPriceLine({
        price: 1.0,
        color: '#f43f5e',
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Start',
      });
    }

    // --- 3. 캔들스틱 (Right Axis) ---
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceScaleId: 'right',
    });
    candleSeries.setData(data as any);

    if (markers.length > 0) {
      candleSeries.setMarkers(markers);
    }

    // --- 4. SMA 지표 (Right Axis - Overlay) ---
    if (visibleIndicators.sma) {
      const smaSeries = chart.addLineSeries({
        color: '#eab308',
        lineWidth: 1,
        title: 'SMA 20',
        priceScaleId: 'right',
      });
      smaSeries.setData(calculateSMA(data, 20));
    }

    // ✅ --- 5. 볼린저 밴드 (Right Axis - Overlay) ---
    // 데이터에 bb_u, bb_m, bb_l이 있을 때만 렌더링
    if (visibleIndicators.bollinger && data[0]?.bb_u) {
      const createBBLine = (color: string) =>
        chart.addLineSeries({
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
        });

      const upperLine = createBBLine('#3b82f6');
      const middleLine = createBBLine('#6366f1');
      const lowerLine = createBBLine('#3b82f6');

      upperLine.setData(data.map((d) => ({ time: d.time, value: d.bb_u as number })));
      middleLine.setData(data.map((d) => ({ time: d.time, value: d.bb_m as number })));
      lowerLine.setData(data.map((d) => ({ time: d.time, value: d.bb_l as number })));
    }

    const hasBB = data.some(d => d.bb_u !== undefined && d.bb_u !== null);
    if (visibleIndicators.bollinger && hasBB) {
      const createBBLine = (color: string) => chart.addLineSeries({
        color, lineWidth: 1, lineStyle: LineStyle.Dashed,
        priceScaleId: 'right', lastValueVisible: false, priceLineVisible: false,
      });

      const upper = createBBLine('#3b82f6');
      const middle = createBBLine('#6366f1');
      const lower = createBBLine('#3b82f6');

      // 데이터 매핑 시 null 방어
      upper.setData(data.filter(d => d.bb_u).map(d => ({ time: d.time, value: d.bb_u! })));
      middle.setData(data.filter(d => d.bb_m).map(d => ({ time: d.time, value: d.bb_m! })));
      lower.setData(data.filter(d => d.bb_l).map(d => ({ time: d.time, value: d.bb_l! })));
    }

    // ✅ --- 6. 보조 지표 패널 분리 (Stack 구조) ---
    let currentBottom = 0; // 최하단부터 쌓아 올림

    const hasMACD = data.some(d => typeof d.macd_h === 'number');

if (visibleIndicators.macd && hasMACD) {
  const macdHistogram = chart.addHistogramSeries({
    priceScaleId: 'macd',
    title: 'MACD Hist',
  });
  
  chart.priceScale('macd').applyOptions({
    visible: true,
    scaleMargins: { top: 0.85, bottom: 0 },
  });

  // null이나 undefined인 아이템은 차트 엔진에 전달하지 않도록 필터링
  const validMacdData = data
    .filter(d => typeof d.macd_h === 'number') // 오직 숫자 타입만 허용
    .map(d => ({
      time: d.time,
      value: d.macd_h as number,
      color: (d.macd_h as number) >= 0 ? '#10b981' : '#ef4444'
    }));

  macdHistogram.setData(validMacdData);
}
    // RSI 패널 (MACD 위 또는 최하단)
    if (visibleIndicators.rsi && data[0]?.rsi) {
      // ✅ 시리즈 생성
      const rsiSeries = chart.addLineSeries({
        color: '#a855f7',
        lineWidth: 1,
        priceScaleId: 'rsi', // 여기서 ID를 지정하면 내부적으로 생성됩니다.
        title: 'RSI',
      });

      // ✅ 동적으로 생성된 'rsi' 축의 옵션을 설정 (여기서 visible: true 효과가 발생)
      chart.priceScale('rsi').applyOptions({
        visible: true,
        borderColor: '#334155',
        scaleMargins: {
          top: 1 - (currentBottom + 0.15),
          bottom: currentBottom,
        },
      });

      rsiSeries.setData(data.map((d) => ({ time: d.time, value: d.rsi as number })));
      currentBottom += 0.2; // 간격을 조금 더 넓게 조정
    }

    // 반응형 대응
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, backtestData, markers, visibleIndicators]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
    />
  );
};
