// 차트 뷰어 전용 — 종목 시세(OHLCV)만 반환.
// 전략 백테스트는 별도 영역(/portfolio)에서 담당.
import { useStockHistoryQuery } from '@/entities/stock/api/stocks-queries';

import { useDashboardStore } from '../model/dashboard-store';

export const useDashboardLogic = () => {
  const symbol = useDashboardStore((s) => s.symbol);
  const historyQuery = useStockHistoryQuery(symbol);

  return {
    mergedData: historyQuery.data?.data ?? [],
    companyName: historyQuery.data?.company_name || symbol,
    isLoading: historyQuery.isLoading,
  };
};
