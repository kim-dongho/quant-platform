'use client';

import { 
  createChart, 
  ColorType, 
  IChartApi, 
  SeriesMarker,
  LineStyle,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import { MarketData, ChartOptions } from '../model/stocks-common';
import { 
  calculateSMA, 
  calculateRSI, 
  calculateMACD 
} from '../lib/indicators';

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

    // 1. 차트 초기화 (Dark 테마 최적화)
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' }, // slate-900
        textColor: '#94a3b8', // slate-400
      },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      leftPriceScale: {
        visible: backtestData.length > 0, // 데이터 있을 때만 노출
        borderColor: '#334155',
        scaleMargins: { top: 0.1, bottom: 0.6 }, // 상단 30% 영역 사용
      },
      rightPriceScale: {
        visible: true,
        borderColor: '#334155',
        scaleMargins: { top: 0.2, bottom: 0.2 },
      },
      timeScale: { borderColor: '#334155', barSpacing: 12 },
    });
    chartRef.current = chart;

    // --- 2. 전략 수익률 곡선 (Left Axis) ---
    if (backtestData.length > 0) {
      const strategySeries = chart.addLineSeries({
        color: '#10b981', 
        lineWidth: 2,
        priceScaleId: 'left',
        title: 'Equity',
      });
      strategySeries.setData(backtestData);

      // 기준선 (원금 1.0)
      strategySeries.createPriceLine({
        price: 1.0,
        color: '#f43f5e', // rose-500
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Start',
      });
    }

    // --- 3. 캔들스틱 (Right Axis) ---
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      priceScaleId: 'right',
    });
    
    // 백엔드에서 이미 포맷팅된 time을 사용하므로 바로 주입
    candleSeries.setData(data as any); 

    if (markers.length > 0) {
      candleSeries.setMarkers(markers);
    }

    // --- 4. SMA 지표 (Right Axis) ---
    if (visibleIndicators.sma) {
      const smaSeries = chart.addLineSeries({ 
        color: '#eab308', lineWidth: 1, title: 'SMA 20', priceScaleId: 'right' 
      });
      smaSeries.setData(calculateSMA(data, 20));
    }

    // --- 5. 보조 지표 (RSI/MACD) - 패널 분리 ---
    let panelBottom = 0.05;
    const panelHeight = 0.15;

    if (visibleIndicators.rsi) {
      const rsiSeries = chart.addLineSeries({
        color: '#a855f7', lineWidth: 1, priceScaleId: 'rsi', title: 'RSI',
      });
      chart.priceScale('rsi').applyOptions({
        scaleMargins: { top: 1 - (panelBottom + panelHeight), bottom: panelBottom },
      });
      rsiSeries.setData(calculateRSI(data, 14));
      panelBottom += panelHeight + 0.05;
    }

    if (visibleIndicators.macd) {
      const macdData = calculateMACD(data);
      const macdLine = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceScaleId: 'macd' });
      chart.priceScale('macd').applyOptions({
        scaleMargins: { top: 1 - (panelBottom + panelHeight), bottom: panelBottom },
      });
      macdLine.setData(macdData.macd);
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

  return <div ref={chartContainerRef} className="w-full bg-slate-900 rounded-lg overflow-hidden" />;
};