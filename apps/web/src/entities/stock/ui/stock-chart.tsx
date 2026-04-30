'use client';

import { useEffect, useRef } from 'react';

import type { CandlestickData, IChartApi, SeriesMarker, Time } from 'lightweight-charts';
import { ColorType, LineStyle, createChart } from 'lightweight-charts';

import { formatPrice, getCurrency } from '@/shared/lib/format-price';

import type { ChartOptions, MarketData } from '../model/stocks-common';

interface Props {
  data: MarketData[];
  backtestData?: { time: string; value: number }[];
  visibleIndicators: ChartOptions;
  markers?: SeriesMarker<string>[];
  symbol?: string;
}

export const StockChart = ({
  data,
  backtestData = [],
  visibleIndicators,
  markers = [],
  symbol,
}: Props) => {
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

    // 통화 기반 price format — 우측 scale의 가격 series(캔들/SMA/BB)에만 선택적으로 적용.
    // chart-level localization은 좌측 equity 스케일의 custom formatter를 덮어쓰므로 사용하지 않는다.
    const isKRW = getCurrency(symbol) === 'KRW';
    const currencyPriceFormat = {
      type: 'custom' as const,
      minMove: isKRW ? 1 : 0.01,
      formatter: (p: number) => formatPrice(p, symbol),
    };

    // 2. 차트 생성
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#434655',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      },
      grid: { vertLines: { color: '#eef2ff' }, horzLines: { color: '#eef2ff' } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 600,

      // 메인 차트 (캔들) 영역 설정
      rightPriceScale: {
        visible: true,
        borderColor: '#c3c6d7',
        scaleMargins: {
          top: 0.05,
          bottom: mainChartBottomMargin + 0.05, // 지표 영역만큼 비워둠 (+여유분)
        },
      },
      // 수익률 차트 (좌측) 영역 설정
      leftPriceScale: {
        visible: backtestData.length > 0,
        borderColor: '#c3c6d7',
        scaleMargins: {
          top: 0.05,
          bottom: mainChartBottomMargin + 0.05,
        },
      },
      timeScale: { borderColor: '#c3c6d7', barSpacing: 10 },
    });
    chartRef.current = chart;

    // --- 3. 시리즈 추가 ---

    // (1) 수익률 라인 — 좌측 축 표기를 equity 배수가 아닌 누적 수익률(%)로 오버라이드
    if (backtestData.length > 0) {
      const strategySeries = chart.addLineSeries({
        color: '#0b1c30',
        lineWidth: 2,
        priceScaleId: 'left',
        priceFormat: {
          type: 'custom',
          minMove: 0.0001,
          formatter: (v: number) => {
            const pct = (v - 1) * 100;
            return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
          },
        },
      });
      strategySeries.setData(backtestData);
      strategySeries.createPriceLine({
        price: 1.0,
        color: '#94a3b8',
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Start',
      });
    }

    // (2) 캔들스틱
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#006c49',
      downColor: '#ba1a1a',
      borderVisible: false,
      wickUpColor: '#006c49',
      wickDownColor: '#ba1a1a',
      priceScaleId: 'right',
      priceFormat: currencyPriceFormat,
    });
    candleSeries.setData(data as unknown as CandlestickData<Time>[]);

    // 마커 세팅 (데이터가 렌더링된 후 호출)
    if (markers.length > 0) {
      candleSeries.setMarkers(markers);
    }

    // (3) 이동평균선 (SMA) — Short: blue, Long: amber (둘 다 non-semantic)
    if (visibleIndicators.sma) {
      if (data.some((d) => typeof d.sma_s === 'number')) {
        const smaShortSeries = chart.addLineSeries({
          color: '#2563eb',
          lineWidth: 2,
          priceScaleId: 'right',
          title: 'SMA Short',
          priceFormat: currencyPriceFormat,
        });
        smaShortSeries.setData(
          data
            .filter((d) => typeof d.sma_s === 'number')
            .map((d) => ({ time: d.time as Time, value: d.sma_s! })),
        );
      }

      if (data.some((d) => typeof d.sma_l === 'number')) {
        const smaLongSeries = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 2,
          priceScaleId: 'right',
          title: 'SMA Long',
          priceFormat: currencyPriceFormat,
        });
        smaLongSeries.setData(
          data
            .filter((d) => typeof d.sma_l === 'number')
            .map((d) => ({ time: d.time as Time, value: d.sma_l! })),
        );
      }
    }

    // (4) 볼린저 밴드 — 옅은 슬레이트 밴드로 배경처럼 처리
    if (visibleIndicators.bollinger && data.some((d) => typeof d.bb_u === 'number')) {
      const createBB = (color: string, width: 1 | 2 = 1) =>
        chart.addLineSeries({
          color,
          lineWidth: width,
          lineStyle: LineStyle.Solid,
          priceScaleId: 'right',
          priceFormat: currencyPriceFormat,
        });

      const u = createBB('#94a3b8'),
        m = createBB('#64748b', 2),
        l = createBB('#94a3b8');

      u.setData(
        data
          .filter((d) => typeof d.bb_u === 'number')
          .map((d) => ({ time: d.time as Time, value: d.bb_u! })),
      );

      m.setData(
        data
          .filter((d) => typeof d.bb_m === 'number')
          .map((d) => ({ time: d.time as Time, value: d.bb_m! })),
      );

      l.setData(
        data
          .filter((d) => typeof d.bb_l === 'number')
          .map((d) => ({ time: d.time as Time, value: d.bb_l! })),
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
            time: d.time as Time,
            value: d.macd_h!,
            // 매매 신호(green/red)와 분리하기 위해 sky / orange 사용
            color: d.macd_h! >= 0 ? '#0ea5e9' : '#f97316',
          })),
      );

      currentPaneIndex++; // 다음 지표를 위해 인덱스 증가
    }

    // RSI 그리기 (MACD 바로 위)
    if (visibleIndicators.rsi && data.some((d) => typeof d.rsi === 'number')) {
      const rsiSeries = chart.addLineSeries({
        color: '#8b5cf6',
        lineWidth: 2,
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
        data
          .filter((d) => typeof d.rsi === 'number')
          .map((d) => ({ time: d.time as Time, value: d.rsi! })),
      );
      rsiSeries.createPriceLine({
        price: 70,
        color: '#c3c6d7',
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: '#c3c6d7',
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
      });

      currentPaneIndex++;
    }

    // 반응형: 컨테이너 크기 변화에 맞춰 width + height 모두 갱신
    const handleResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(chartContainerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, backtestData, visibleIndicators, markers, symbol]);

  return <div ref={chartContainerRef} className="h-full w-full" />;
};
