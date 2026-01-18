'use client';

import { 
  createChart, 
  ColorType, 
  IChartApi, 
  SeriesMarker 
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import { MarketData, ChartOptions } from '../model/types';
import { 
  calculateSMA, 
  calculateBollingerBands, 
  calculateRSI, 
  calculateMACD 
} from '../lib/indicators';

interface Props {
  data: MarketData[];
  markers?: SeriesMarker<string>[];
  visibleIndicators: ChartOptions; 
}

export const StockChart = ({ data, markers = [], visibleIndicators }: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. 차트 기본 설정
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111' },
        textColor: '#DDD',
      },
      grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      rightPriceScale: { 
        scaleMargins: { top: 0.05, bottom: 0.05 } // 초기값 (나중에 덮어씌워짐)
      },
      timeScale: {
        borderColor: '#222',
      },
    });
    chartRef.current = chart;


    // -----------------------------------------------------------
    // 📐 동적 레이아웃 계산 로직 (활성화된 패널 수에 따라 영역 분배)
    // -----------------------------------------------------------
    
    // 하단 패널들 (Volume, RSI, MACD) 중 켜져 있는 것의 개수 카운트
    const activePanels = [
      visibleIndicators.volume, 
      visibleIndicators.rsi, 
      visibleIndicators.macd
    ].filter(Boolean).length;

    // 패널 하나당 차트 높이의 20% 할당
    let mainChartBottom = 0.05; // 기본 하단 여백
    if (activePanels > 0) {
      mainChartBottom = 0.2 * activePanels; 
    }

    // 메인 차트(캔들) 영역 설정
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.05,
        bottom: mainChartBottom, // 계산된 공간만큼 비워둠
      },
    });


    // --- 2. 메인: 캔들 차트 (항상 표시) ---
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350', 
      borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    
    candleSeries.setData(data.map((item) => ({
      time: item.time.split('T')[0], 
      open: item.open, high: item.high, low: item.low, close: item.close,
    })));

    // 마커 추가
    if (markers.length > 0) {
      const sortedMarkers = [...markers].sort((a, b) => 
        new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      candleSeries.setMarkers(sortedMarkers);
    }

    // SMA (항상 표시 - 필요시 이것도 토글 가능)
    const smaSeries = chart.addLineSeries({ color: '#F4D03F', lineWidth: 2, title: 'SMA 20' });
    smaSeries.setData(calculateSMA(data, 20));


    // --- 3. 메인 보조: 볼린저 밴드 (Toggle) ---
    if (visibleIndicators.bollinger) {
      const bbData = calculateBollingerBands(data, 20, 2);
      
      const upper = chart.addLineSeries({ color: 'rgba(41, 98, 255, 0.5)', lineWidth: 1, title: 'BB Upper' });
      const lower = chart.addLineSeries({ color: 'rgba(41, 98, 255, 0.5)', lineWidth: 1, title: 'BB Lower' });
      
      upper.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
      lower.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
    }


    // -----------------------------------------------------------
    // 👇 하단 패널 스태킹 로직
    // -----------------------------------------------------------
    let currentPanelTop = 1 - mainChartBottom; // 여기서부터 아래로 하나씩 쌓음
    const panelHeight = 0.2; // 각 패널 높이 고정 (20%)


    // --- 4. 패널 1: 거래량 (Toggle) ---
    if (visibleIndicators.volume) {
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol', // 별도 스케일 ID
      });
      
      chart.priceScale('vol').applyOptions({
        scaleMargins: { 
          top: currentPanelTop + 0.05, // 살짝 여백 줌
          bottom: mainChartBottom - panelHeight 
        },
      });
      
      volumeSeries.setData(data.map((item) => ({
        time: item.time.split('T')[0], value: item.volume,
        color: item.close >= item.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
      })));
      
      // 다음 패널 위치 조정
      currentPanelTop += panelHeight; 
      mainChartBottom -= panelHeight;
    }


    // --- 5. 패널 2: RSI (Toggle) ---
    if (visibleIndicators.rsi) {
      const rsiSeries = chart.addLineSeries({
        color: '#9E24F5', lineWidth: 2, priceScaleId: 'rsi', title: 'RSI(14)',
      });
      
      chart.priceScale('rsi').applyOptions({
        scaleMargins: { 
          top: currentPanelTop + 0.05, 
          bottom: mainChartBottom - panelHeight 
        },
      });
      
      rsiSeries.setData(calculateRSI(data, 14));
      
      // 기준선 (70/30)
      rsiSeries.createPriceLine({ price: 70, color: '#FF4444', lineStyle: 2, axisLabelVisible: true });
      rsiSeries.createPriceLine({ price: 30, color: '#26a69a', lineStyle: 2, axisLabelVisible: true });

      currentPanelTop += panelHeight;
      mainChartBottom -= panelHeight;
    }


    // --- 6. 패널 3: MACD (Toggle) ---
    if (visibleIndicators.macd) {
      const macdData = calculateMACD(data);
      
      // MACD Histogram
      const macdHistSeries = chart.addHistogramSeries({ priceScaleId: 'macd' });
      // MACD Line
      const macdLineSeries = chart.addLineSeries({ color: '#2962FF', lineWidth: 2, priceScaleId: 'macd', title: 'MACD' });
      // Signal Line
      const signalLineSeries = chart.addLineSeries({ color: '#FF6D00', lineWidth: 2, priceScaleId: 'macd', title: 'Signal' });

      chart.priceScale('macd').applyOptions({
        scaleMargins: { 
          top: currentPanelTop + 0.05, 
          bottom: mainChartBottom - panelHeight 
        },
      });

      macdHistSeries.setData(macdData.histogram.map(d => ({
        time: d.time, value: d.value,
        color: d.value >= 0 ? '#26a69a' : '#ef5350',
      })));
      macdLineSeries.setData(macdData.macd);
      signalLineSeries.setData(macdData.signal);
    }

    // 리사이즈 핸들러
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

  }, [data, markers, visibleIndicators]); // 옵션 변경 시 차트 재생성

  return <div ref={chartContainerRef} className="w-full h-[600px]" />;
};