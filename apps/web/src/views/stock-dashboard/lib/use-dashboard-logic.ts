// 차트 뷰어 전용 — 종목 시세(OHLCV)만 반환. timeframe 별로 다른 데이터 fetch.
// 전략 백테스트는 별도 영역(/portfolio)에서 담당.
import { useStockHistoryQuery } from '@/entities/stock/api/stocks-queries';
import type { MarketData } from '@/entities/stock/model/stocks-common';

import { useDashboardStore } from '../model/dashboard-store';

// Lightweight-charts 는 string time 에서 'yyyy-mm-dd' 만 받음.
// 1h / 4h 봉이 보내는 'yyyy-mm-ddTHH:MM:SS' 는 UNIX timestamp (초) 로 변환 필요.
const normalizeTime = (rows: MarketData[]): MarketData[] =>
  rows.map((r) =>
    typeof r.time === 'string' && r.time.includes('T')
      ? { ...r, time: Math.floor(new Date(r.time).getTime() / 1000) }
      : r,
  );

export const useDashboardLogic = () => {
  const symbol = useDashboardStore((s) => s.symbol);
  const timeframe = useDashboardStore((s) => s.timeframe);
  const historyQuery = useStockHistoryQuery(symbol, timeframe);

  const mergedData = normalizeTime(historyQuery.data?.data ?? []);

  return {
    mergedData,
    companyName: historyQuery.data?.company_name || symbol,
    isLoading: historyQuery.isLoading,
    timeframe,
  };
};
