'use client';

import { 
  createChart, 
  ColorType, 
  IChartApi, 
  SeriesMarker 
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { MarketData } from '../model/types';
import { calculateSMA, calculateBollingerBands } from '../lib/indicators';

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

    // 1. 차트 기본 설정
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors?.backgroundColor || '#111' },
        textColor: colors?.textColor || '#DDD',
      },
      grid: {
        vertLines: { color: '#222' },
        horzLines: { color: '#222' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,    // 상단 여백
          bottom: 0.2, // 하단 여백 (거래량 공간 확보)
        },
      },
    });

    chartRef.current = chart;

    // --- 2. 캔들 차트 (Main Series) ---
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const formattedData = data.map((item) => ({
      time: item.time.split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));
    candleSeries.setData(formattedData);

    // 마커 설정 (골든크로스/데드크로스 등)
    if (markers.length > 0) {
      const sortedMarkers = [...markers].sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
      });
      candleSeries.setMarkers(sortedMarkers);
    }

    // --- 3. 이동평균선 (SMA 20) ---
    const smaSeries = chart.addLineSeries({
      color: '#F4D03F', // 노란색
      lineWidth: 2,
      title: 'SMA 20',
    });
    smaSeries.setData(calculateSMA(data, 20));

    // --- 🆕 4. 볼린저 밴드 (Bollinger Bands) ---
    const bbData = calculateBollingerBands(data, 20, 2);

    // 4-1. 상단 밴드
    const upperSeries = chart.addLineSeries({
      color: 'rgba(41, 98, 255, 0.5)', // 반투명 파란색
      lineWidth: 1,
      title: 'BB Upper',
    });
    upperSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })));

    // 4-2. 하단 밴드
    const lowerSeries = chart.addLineSeries({
      color: 'rgba(41, 98, 255, 0.5)', // 반투명 파란색
      lineWidth: 1,
      title: 'BB Lower',
    });
    lowerSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })));


    // --- 5. 거래량 (Volume) ---
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', // 메인 가격축과 분리
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


    // --- 6. 반응형 리사이즈 ---
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