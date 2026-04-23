import { useQuery } from '@tanstack/react-query';

import { getBacktestResult, getStockHistory, getStockList, searchStocks } from './stocks-api';

// 시세 데이터 쿼리
export const useStockHistoryQuery = (symbol: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['stockHistory', symbol],
    queryFn: async () => {
      const res = await getStockHistory(symbol);
      return 'data' in res ? res : { company_name: symbol, data: res as any };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!symbol && (options?.enabled ?? true),
    retry: 1,
  });
};

// 백테스트 쿼리
export const useBacktestQuery = (symbol: string, params: any, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['backtest', symbol, params],
    queryFn: () => getBacktestResult(symbol, params),
    staleTime: 1000 * 60 * 1,
    enabled: !!symbol && enabled,
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
