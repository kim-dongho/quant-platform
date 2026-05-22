import { useQuery } from '@tanstack/react-query';

import { type Timeframe, getStockHistory, getStockList, searchStocks } from './stocks-api';

// 시세 데이터 쿼리 — timeframe 별로 query key 분리.
export const useStockHistoryQuery = (
  symbol: string,
  timeframe: Timeframe = '1d',
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['stockHistory', symbol, timeframe],
    queryFn: () => getStockHistory(symbol, timeframe),
    staleTime: 1000 * 60 * 5,
    enabled: !!symbol && (options?.enabled ?? true),
    retry: 1,
  });
};

// 주식 리스트 조회 쿼리
export const useStockListQuery = () => {
  return useQuery({
    queryKey: ['stockList'],
    queryFn: getStockList,
    staleTime: 1000 * 60 * 60,
  });
};

// 자동완성 검색 — 빈 쿼리거나 비활성화면 호출 생략
export const useStockSearchQuery = (q: string, options?: { enabled?: boolean; limit?: number }) => {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['stockSearch', trimmed, options?.limit ?? 20],
    queryFn: () => searchStocks(trimmed, options?.limit ?? 20),
    enabled: trimmed.length > 0 && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
};
