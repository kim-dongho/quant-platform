'use client';

import { useEffect, useRef } from 'react';

import { ColorType, IChartApi, LineStyle, SeriesMarker, createChart } from 'lightweight-charts';

import { ChartOptions, MarketData } from '../model/stocks-common';

interface Props {
  data: MarketData[];
  backtestData?: { time: string; value: number }[];
  visibleIndicators: ChartOptions;
  markers?: SeriesMarker<string>[];
}

export const StockChart = ({ data, backtestData = [], visibleIndicators, markers = [] }: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // 1. 하단 패널(Pane) 개수 계산
    // RSI와 MACD가 켜져 있는지 확인하여 필요한 하단 여백을 계산합니다.
    const paneHeight = 0.15; // 각 지표당 높이 15%
    let activePanes = 0;
    if (visibleIndicators.rsi) activePanes++;
    if (visibleIndicators.macd) activePanes++;

    // 메인 차트가 확보해야 할 하단 여백 (지표 개수 * 높이)
    const mainChartBottomMargin = activePanes * paneHeight;

    // 2. 차트 생성
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: chartContainerRef.current.clientWidth,
      height: 600,

      // 메인 차트 (캔들) 영역 설정
      rightPriceScale: {
        visible: true,
        borderColor: '#334155',
        scaleMargins: {
          top: 0.05,
          bottom: mainChartBottomMargin + 0.05, // 지표 영역만큼 비워둠 (+여유분)
        },
      },
      // 수익률 차트 (좌측) 영역 설정
      leftPriceScale: {
        visible: backtestData.length > 0,
        borderColor: '#334155',
        scaleMargins: {
          top: 0.05,
          bottom: mainChartBottomMargin + 0.05,
        },
      },
      timeScale: { borderColor: '#334155', barSpacing: 10 },
    });
    chartRef.current = chart;

    // --- 3. 시리즈 추가 ---

    // (1) 수익률 라인
    if (backtestData.length > 0) {
      const strategySeries = chart.addLineSeries({
        color: '#ffffff',
        lineWidth: 2,
        priceScaleId: 'left',
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

    // (2) 캔들스틱
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceScaleId: 'right',
    });
    candleSeries.setData(data as any);

    // 마커 세팅 (데이터가 렌더링된 후 호출)
    if (markers.length > 0) {
      candleSeries.setMarkers(markers);
    }

    // (3) 이동평균선 (SMA)
    if (visibleIndicators.sma) {
      // 🟡 단기 이평선 (Short) - 노란색
      if (data.some((d) => typeof d.sma_s === 'number')) {
        const smaShortSeries = chart.addLineSeries({
          color: '#fbbf24', // Yellow 400
          lineWidth: 2,
          priceScaleId: 'right',
          title: 'SMA Short',
        });
        smaShortSeries.setData(
          data
            .filter((d) => typeof d.sma_s === 'number')
            .map((d) => ({ time: d.time, value: d.sma_s! })),
        );
      }

      // 🔵 장기 이평선 (Long) - 파란색
      if (data.some((d) => typeof d.sma_l === 'number')) {
        const smaLongSeries = chart.addLineSeries({
          color: '#60a5fa', // Blue 400
          lineWidth: 2,
          priceScaleId: 'right',
          title: 'SMA Long',
        });
        smaLongSeries.setData(
          data
            .filter((d) => typeof d.sma_l === 'number')
            .map((d) => ({ time: d.time, value: d.sma_l! })),
        );
      }
    }

    // (4) 볼린저 밴드
    if (visibleIndicators.bollinger && data.some((d) => typeof d.bb_u === 'number')) {
      const createBB = (color: string) =>
        chart.addLineSeries({
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          priceScaleId: 'right',
        });

      const u = createBB('#3b82f6'),
        m = createBB('#6366f1'),
        l = createBB('#3b82f6');

      u.setData(
        data
          .filter((d) => typeof d.bb_u === 'number')
          .map((d) => ({ time: d.time, value: d.bb_u! })),
      );

      m.setData(
        data
          .filter((d) => typeof d.bb_m === 'number')
          .map((d) => ({ time: d.time, value: d.bb_m! })),
      );

      l.setData(
        data
          .filter((d) => typeof d.bb_l === 'number')
          .map((d) => ({ time: d.time, value: d.bb_l! })),
      );
    }

    // 하단 지표 (RSI & MACD) 로직

    let currentPaneIndex = 0; // 지표 순서 (아래에서부터 0, 1...)

    // MACD 그리기 (맨 아래 배치)
    if (visibleIndicators.macd && data.some((d) => typeof d.macd_h === 'number')) {
      const macdSeries = chart.addHistogramSeries({
        priceScaleId: 'macd',
        title: 'MACD',
      });

      // 영역 계산: 맨 아래(bottom: 0)부터 paneHeight만큼 차지
      // top은 위에서부터의 거리이므로: 1 - (현재높이 + 패널높이)
      const bottomMargin = currentPaneIndex * paneHeight;
      const topMargin = 1 - (bottomMargin + paneHeight);

      chart.priceScale('macd').applyOptions({
        visible: true,
        scaleMargins: {
          top: topMargin, // 예: 0.85
          bottom: bottomMargin, // 예: 0
        },
      });

      macdSeries.setData(
        data
          .filter((d) => typeof d.macd_h === 'number')
          .map((d) => ({
            time: d.time,
            value: d.macd_h!,
            color: d.macd_h! >= 0 ? '#10b981' : '#ef4444',
          })),
      );

      currentPaneIndex++; // 다음 지표를 위해 인덱스 증가
    }

    // RSI 그리기 (MACD 바로 위)
    if (visibleIndicators.rsi && data.some((d) => typeof d.rsi === 'number')) {
      const rsiSeries = chart.addLineSeries({
        color: '#a855f7',
        lineWidth: 1,
        priceScaleId: 'rsi',
        title: 'RSI',
      });

      // 영역 계산
      const bottomMargin = currentPaneIndex * paneHeight;
      const topMargin = 1 - (bottomMargin + paneHeight);

      chart.priceScale('rsi').applyOptions({
        visible: true,
        scaleMargins: {
          top: topMargin, // 예: 0.70 (MACD가 있으면)
          bottom: bottomMargin, // 예: 0.15 (MACD가 있으면)
        },
      });

      rsiSeries.setData(
        data.filter((d) => typeof d.rsi === 'number').map((d) => ({ time: d.time, value: d.rsi! })),
      );
      rsiSeries.createPriceLine({
        price: 70,
        color: '#475569',
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: '#475569',
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
      });

      currentPaneIndex++;
    }

    // 반응형
    const handleResize = () => {
      if (chartContainerRef.current)
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, backtestData, visibleIndicators, markers]);

  return <div ref={chartContainerRef} className="h-full w-full" />;
};
