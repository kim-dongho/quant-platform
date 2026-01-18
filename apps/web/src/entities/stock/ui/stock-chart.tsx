'use client';

import { 
  createChart, 
  ColorType, 
  IChartApi, 
  SeriesMarker 
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { MarketData } from '../model/types';
import { calculateSMA } from '../lib/indicators';

interface Props {
  data: MarketData[];
  markers?: SeriesMarker<string>[];
  colors?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

export const StockChart = ({ data, markers = [], colors }: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. 차트 생성
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors?.backgroundColor || '#111' },
        textColor: colors?.textColor || '#DDD',
      },
      grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      rightPriceScale: {
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
    });

    chartRef.current = chart;

    // --- 2. 캔들 차트 (v4 방식: addCandlestickSeries) ---
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const formattedData = data.map((item) => ({
      time: item.time.split('T')[0],
      open: item.open, high: item.high, low: item.low, close: item.close,
    }));
    candleSeries.setData(formattedData);

    // 마커 설정
    if (markers.length > 0) {
      const sortedMarkers = [...markers].sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
      });
      candleSeries.setMarkers(sortedMarkers);
    }

    // --- 3. 이동평균선 (LineSeries) ---
    const smaSeries = chart.addLineSeries({
      color: '#F4D03F', lineWidth: 2,
    });
    smaSeries.setData(calculateSMA(data, 20));

    // --- 4. 거래량 (HistogramSeries) ---
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    
    const volumeData = data.map((item) => ({
      time: item.time.split('T')[0],
      value: item.volume,
      color: item.close >= item.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
    }));
    volumeSeries.setData(volumeData);

    // 리사이즈
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
  }, [data, markers, colors]);

  return <div ref={chartContainerRef} className="w-full h-[500px]" />;
};