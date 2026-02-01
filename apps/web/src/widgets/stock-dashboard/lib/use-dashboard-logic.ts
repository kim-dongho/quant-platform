import { useMemo } from 'react';

import { SeriesMarker } from 'lightweight-charts';

import { useBacktestQuery, useStockHistoryQuery } from '@/entities/stock/api/stocks-queries';

import { useDashboardStore } from '../model/dashborad-store';

export const useDashboardLogic = () => {
  const symbol = useDashboardStore((s) => s.symbol);
  const params = useDashboardStore((s) => s.strategyParams);

  const historyQuery = useStockHistoryQuery(symbol);
  const backtestQuery = useBacktestQuery(symbol, params, !!historyQuery.data);

  // 데이터 병합과 동시에 마커(Markers) 배열 생성
  const { mergedData, markers } = useMemo(() => {
    const rawData = historyQuery.data?.data;
    const results = backtestQuery.data?.results;

    if (!rawData) return { mergedData: [], markers: [] };
    if (!results) return { mergedData: rawData, markers: [] };

    const indicatorMap = new Map(results.map((item: any) => [item.time, item]));
    const generatedMarkers: SeriesMarker<string>[] = []; // 마커 담을 배열

    const merged = rawData.map((candle: any) => {
      const indicators = indicatorMap.get(candle.time);

      // 🎯 매매 신호가 있으면 마커 생성
      if (indicators?.action) {
        if (indicators.action === 'buy') {
          generatedMarkers.push({
            time: candle.time,
            position: 'belowBar', // 캔들 아래에 표시
            color: '#22c55e', // 초록색
            shape: 'arrowUp', // 위쪽 화살표
            text: 'BUY',
            size: 2, // 크기 조절 (기본값 1)
          });
        } else if (indicators.action === 'sell') {
          generatedMarkers.push({
            time: candle.time,
            position: 'aboveBar', // 캔들 위에 표시
            color: '#ef4444', // 빨간색
            shape: 'arrowDown', // 아래쪽 화살표
            text: 'SELL',
            size: 2,
          });
        }
      }

      return {
        ...candle,
        rsi: indicators?.rsi,
        macd: indicators?.macd,
        macd_h: indicators?.macd_h,
        bb_u: indicators?.bb_u,
        bb_m: indicators?.bb_m,
        bb_l: indicators?.bb_l,
      };
    });

    return { mergedData: merged, markers: generatedMarkers };
  }, [historyQuery.data, backtestQuery.data]);

  return {
    mergedData,
    markers, // ✅ 외부로 리턴
    backtestLine: backtestQuery.data?.results || [],
    companyName: historyQuery.data?.company_name || symbol,
    isLoading: historyQuery.isLoading || backtestQuery.isLoading,
    currentPrice: mergedData[mergedData.length - 1]?.close || 0,
    refetch: () => {
      historyQuery.refetch();
      if (historyQuery.data) backtestQuery.refetch();
    },
  };
};
