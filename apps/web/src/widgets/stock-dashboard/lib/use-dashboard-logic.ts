import { useMemo } from 'react';

import { useBacktestQuery, useStockHistoryQuery } from '@/entities/stock/api/stocks-queries';
import { MarketData } from '@/entities/stock/model/stocks-common';

import { useDashboardStore } from '../model/dashborad-store';

export const useDashboardLogic = () => {
  // Zustand에서 UI 상태 가져오기
  const symbol = useDashboardStore((s) => s.symbol);
  const params = useDashboardStore((s) => s.strategyParams);

  // React Query 실행
  const historyQuery = useStockHistoryQuery(symbol);
  const backtestQuery = useBacktestQuery(symbol, params);

  // 데이터 병합
  const mergedData = useMemo(() => {
    const rawData = historyQuery.data?.data;
    const results = backtestQuery.data?.results;

    if (!rawData) return [];
    if (!results) return rawData;

    const indicatorMap = new Map(results.map((item: any) => [item.time, item]));

    return rawData.map((candle: any) => {
      const indicators = indicatorMap.get(candle.time) as MarketData;
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
  }, [historyQuery.data, backtestQuery.data]);

  return {
    mergedData,
    companyName: historyQuery.data?.company_name || symbol,
    isLoading: historyQuery.isLoading || backtestQuery.isLoading,
    currentPrice: mergedData[mergedData.length - 1]?.close || 0,
    backtestLine: backtestQuery.data?.results || [],
    refetch: () => {
      historyQuery.refetch();
      backtestQuery.refetch();
    },
  };
};
