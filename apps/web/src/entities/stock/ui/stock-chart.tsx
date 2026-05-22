'use client';

import { useEffect, useRef } from 'react';

import type {
  CandlestickData,
  IChartApi,
  LogicalRange,
  SeriesMarker,
  Time,
} from 'lightweight-charts';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';

import { formatPrice, getCurrency } from '@/shared/lib/format-price';

import type { Timeframe } from '../api/stocks-api';
import {
  computeAndrewsPitchfork,
  computeDonchianChannel,
  computeHHHLTrendline,
  computeHorizontalLevels,
  computeKeltnerChannel,
  computeLinearRegressionChannel,
  computePivotTrendlines,
  computeStandardErrorChannel,
} from '../lib/channels';
import type { ChartOptions, MarketData } from '../model/stocks-common';

interface Props {
  data: MarketData[];
  backtestData?: { time: string; value: number }[];
  visibleIndicators: ChartOptions;
  markers?: SeriesMarker<string>[];
  symbol?: string;
  // 채널 기간을 일봉 6개월 = 130 거래일 기준으로 timeframe 환산.
  // 같은 시간 범위 (≈6개월) 를 timeframe 별 다른 해상도로 보기 위함.
  timeframe?: Timeframe;
}

// 일봉 6개월 (130 거래일) 시간 범위에 해당하는 봉 수 — multi-timeframe 정합성.
const CHANNEL_PERIOD_BY_TIMEFRAME: Record<Timeframe, number> = {
  '1d': 130,
  '4h': 260, // 130 × 2 (US 정규장 4h 봉 약 2개/day)
  '1h': 900, // 130 × ~7 (US 정규장 6.5h)
};

export const StockChart = ({
  data,
  backtestData = [],
  visibleIndicators,
  markers = [],
  symbol,
  timeframe = '1d',
}: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // 채널 토글 시 차트가 재생성돼도 zoom/pan 위치를 유지하기 위한 보관소.
  // symbol/timeframe 이 바뀌면 무효화 (다른 데이터라 같은 range 가 의미 없음).
  const lastRangeRef = useRef<LogicalRange | null>(null);
  const lastContextRef = useRef<string>('');

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const currentContext = `${symbol}|${timeframe}`;
    const sameContext = lastContextRef.current === currentContext;
    lastContextRef.current = currentContext;

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
      const strategySeries = chart.addSeries(LineSeries, {
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
    const candleSeries = chart.addSeries(CandlestickSeries, {
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
      createSeriesMarkers(candleSeries, markers);
    }

    // (3) 이동평균선 (SMA) — Short: blue, Long: amber (둘 다 non-semantic)
    if (visibleIndicators.sma) {
      if (data.some((d) => typeof d.sma_s === 'number')) {
        const smaShortSeries = chart.addSeries(LineSeries, {
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
        const smaLongSeries = chart.addSeries(LineSeries, {
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
        chart.addSeries(LineSeries, {
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

    // 채널 series 는 가격 series 의 autoscale 결정에서 제외 — 안 그러면
    // ±2σ band 나 trendline 연장선이 차트 위/아래로 튀어나와 가격 본체가
    // 압축돼 보임. null 반환 = 이 series 는 y축 자동 스케일에 기여하지 않음.
    const noAutoscale = { autoscaleInfoProvider: () => null };

    // (5) Linear Regression Channel — 일봉 6개월 환산 봉수 (timeframe 별) OLS 의
    // ±1σ / ±2σ / ±3σ 실선. multi-timeframe 정합성 — 같은 시간 범위 (~6개월) 를
    // 다른 해상도로. 1σ = 정상 (68%), 2σ = 확장 (95%), 3σ = 극단 (99.7%).
    // 1σ 가 가장 굵게, 외곽으로 갈수록 얇게.
    if (visibleIndicators.lrChannel) {
      const channelPeriod = CHANNEL_PERIOD_BY_TIMEFRAME[timeframe];
      const lr1 = computeLinearRegressionChannel(data, channelPeriod, 1);
      const lr2 = computeLinearRegressionChannel(data, channelPeriod, 2);
      const lr3 = computeLinearRegressionChannel(data, channelPeriod, 3);
      if (lr1.upper.length > 0) {
        const mkLR = (width: 1 | 2) =>
          chart.addSeries(LineSeries, {
            color: '#a855f7',
            lineWidth: width,
            lineStyle: LineStyle.Solid,
            priceScaleId: 'right',
            priceFormat: currencyPriceFormat,
            ...noAutoscale,
          });
        const u1 = mkLR(2);
        const l1 = mkLR(2);
        const u2 = mkLR(1);
        const l2 = mkLR(1);
        const u3 = mkLR(1);
        const l3 = mkLR(1);
        u1.setData(lr1.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        l1.setData(lr1.lower.map((p) => ({ time: p.time as Time, value: p.value })));
        u2.setData(lr2.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        l2.setData(lr2.lower.map((p) => ({ time: p.time as Time, value: p.value })));
        u3.setData(lr3.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        l3.setData(lr3.lower.map((p) => ({ time: p.time as Time, value: p.value })));
      }
    }

    // (5b) Standard Error Channel — 회귀선 ±2×SE (=σ/√n) 분홍 실선.
    // LR ±σ 가 가격 변동 범위라면 이건 회귀선 자체의 신뢰구간.
    // 매우 좁아서 추세 정확도가 한눈에 — n 이 클수록 더 좁아짐.
    if (visibleIndicators.standardError) {
      const channelPeriod = CHANNEL_PERIOD_BY_TIMEFRAME[timeframe];
      const se = computeStandardErrorChannel(data, channelPeriod, 2);
      if (se.upper.length > 0) {
        const mkSE = () =>
          chart.addSeries(LineSeries, {
            color: '#ec4899',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            priceScaleId: 'right',
            priceFormat: currencyPriceFormat,
            ...noAutoscale,
          });
        const u = mkSE();
        const l = mkSE();
        u.setData(se.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        l.setData(se.lower.map((p) => ({ time: p.time as Time, value: p.value })));
      }
    }

    // (6) Donchian Channel — rolling 60봉 high/low
    if (visibleIndicators.donchian) {
      const d = computeDonchianChannel(data, 60);
      if (d.upper.length > 0) {
        const mkD = () =>
          chart.addSeries(LineSeries, {
            color: '#f97316',
            lineWidth: 1,
            priceScaleId: 'right',
            priceFormat: currencyPriceFormat,
            ...noAutoscale,
          });
        const u = mkD();
        const l = mkD();
        u.setData(d.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        l.setData(d.lower.map((p) => ({ time: p.time as Time, value: p.value })));
      }
    }

    // (6b) Keltner Channel — EMA20 ± 2×ATR (변동성 기반 청록).
    // σ 와 다른 정보: ATR 가 고가-저가 범위 반영해 갭/whipsaw 에 robust.
    if (visibleIndicators.keltner) {
      const kel = computeKeltnerChannel(data, 20, 20, 2);
      if (kel.upper.length > 0) {
        const mkK = (style: LineStyle, width: 1 | 2) =>
          chart.addSeries(LineSeries, {
            color: '#0ea5e9',
            lineWidth: width,
            lineStyle: style,
            priceScaleId: 'right',
            priceFormat: currencyPriceFormat,
            ...noAutoscale,
          });
        const u = mkK(LineStyle.Solid, 1);
        const m = mkK(LineStyle.Dotted, 1);
        const l = mkK(LineStyle.Solid, 1);
        u.setData(kel.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        m.setData(kel.mid.map((p) => ({ time: p.time as Time, value: p.value })));
        l.setData(kel.lower.map((p) => ({ time: p.time as Time, value: p.value })));
      }
    }

    // (6c) Andrews' Pitchfork — 3 swing point 기반 미디언 + 평행 채널 (황갈).
    // 미디언선이 magnet 역할 — 가격이 자주 회귀하는 중심.
    if (visibleIndicators.pitchfork) {
      const pf = computeAndrewsPitchfork(data, 250, 5);
      if (pf.median.length > 0) {
        const mkPF = (width: 1 | 2) =>
          chart.addSeries(LineSeries, {
            color: '#d97706',
            lineWidth: width,
            lineStyle: LineStyle.Solid,
            priceScaleId: 'right',
            priceFormat: currencyPriceFormat,
            ...noAutoscale,
          });
        const u = mkPF(1);
        const m = mkPF(2);
        const l = mkPF(1);
        u.setData(pf.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        m.setData(pf.median.map((p) => ({ time: p.time as Time, value: p.value })));
        l.setData(pf.lower.map((p) => ({ time: p.time as Time, value: p.value })));
      }
    }

    // (6d) HH/HL Trendline — Dow 이론. 단조 증가만 인정해 추세 정의.
    // 녹색 = HH 상단 trendline, 적색 = HL 하단 (uptrend 시 둘 다 살아있음).
    if (visibleIndicators.hhhl) {
      const hh = computeHHHLTrendline(data, 250, 5);
      const mkHH = (color: string) =>
        chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          priceScaleId: 'right',
          priceFormat: currencyPriceFormat,
          ...noAutoscale,
        });
      if (hh.hhLine.length > 0) {
        const r = mkHH('#22c55e');
        r.setData(hh.hhLine.map((p) => ({ time: p.time as Time, value: p.value })));
      }
      if (hh.hlLine.length > 0) {
        const s = mkHH('#ef4444');
        s.setData(hh.hlLine.map((p) => ({ time: p.time as Time, value: p.value })));
      }
    }

    // (6e) Horizontal S/R levels — 직전 swing high/low 가로 점선.
    // 채널 돌파 후 가격이 실제로 닿았던 다음 타겟 — "장대양봉 위 어디까지?".
    if (visibleIndicators.horizontalLevels) {
      const hl = computeHorizontalLevels(data, 250, 5, 4);
      const mkLevel = (color: string) =>
        chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceScaleId: 'right',
          priceFormat: currencyPriceFormat,
          ...noAutoscale,
        });
      hl.resistanceLevels.forEach((lvl) => {
        const s = mkLevel('#64748b');
        s.setData(lvl.map((p) => ({ time: p.time as Time, value: p.value })));
      });
      hl.supportLevels.forEach((lvl) => {
        const s = mkLevel('#64748b');
        s.setData(lvl.map((p) => ({ time: p.time as Time, value: p.value })));
      });
    }

    // (7) Pivot Trendline — 250봉 중 swing high/low 검출 후 최근 2점 연결
    if (visibleIndicators.pivotTrendline) {
      const p = computePivotTrendlines(data, 250, 5);
      const mkP = () =>
        chart.addSeries(LineSeries, {
          color: '#14b8a6',
          lineWidth: 2,
          priceScaleId: 'right',
          priceFormat: currencyPriceFormat,
          ...noAutoscale,
        });
      if (p.resistance.length > 0) {
        const r = mkP();
        r.setData(p.resistance.map((q) => ({ time: q.time as Time, value: q.value })));
      }
      if (p.support.length > 0) {
        const s = mkP();
        s.setData(p.support.map((q) => ({ time: q.time as Time, value: q.value })));
      }
    }

    // 하단 지표 (RSI & MACD) 로직

    let currentPaneIndex = 0; // 지표 순서 (아래에서부터 0, 1...)

    // MACD 그리기 (맨 아래 배치)
    if (visibleIndicators.macd && data.some((d) => typeof d.macd_h === 'number')) {
      const macdSeries = chart.addSeries(HistogramSeries, {
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
      const rsiSeries = chart.addSeries(LineSeries, {
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

    // 채널 토글로 재생성된 경우 (같은 symbol/timeframe) 이전 zoom 위치 복원.
    // 종목·timeframe 변경 시엔 lastRange 가 의미 없으므로 skip → fitContent 디폴트.
    if (sameContext && lastRangeRef.current) {
      try {
        chart.timeScale().setVisibleLogicalRange(lastRangeRef.current);
      } catch {
        // range 가 데이터 범위 벗어나면 무시
      }
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
      // cleanup 직전 현재 visible range 저장 — 다음 effect 에서 복원.
      try {
        lastRangeRef.current = chart.timeScale().getVisibleLogicalRange();
      } catch {
        // 차트 이미 dispose 된 경우 무시
      }
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, backtestData, visibleIndicators, markers, symbol, timeframe]);

  return <div ref={chartContainerRef} className="h-full w-full" />;
};
