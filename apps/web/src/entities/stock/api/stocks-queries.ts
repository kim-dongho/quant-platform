import { useQuery } from '@tanstack/react-query';

import { getBacktestResult, getStockHistory, getStockList } from './stocks-api';

// 시세 데이터 쿼리
export const useStockHistoryQuery = (symbol: string) => {
  return useQuery({
    queryKey: ['stockHistory', symbol],
    queryFn: async () => {
      const res = await getStockHistory(symbol);
      return 'data' in res ? res : { company_name: symbol, data: res as any };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!symbol,
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
