import { apiClient } from '@/shared/api/client';

import type {
  GetStockListResponseDto,
  SearchStocksResponseDto,
  getStockHistoryResponseDto,
} from '../model/stocks-dto';

export type Timeframe = '1d' | '1h' | '4h';

/**
 * 주식 시세 히스토리 조회 — timeframe 지정 (기본 1d).
 */
export const getStockHistory = async (
  symbol: string,
  timeframe: Timeframe = '1d',
): Promise<getStockHistoryResponseDto> => {
  const { data } = await apiClient.get<getStockHistoryResponseDto>(`/stocks/${symbol}/history`, {
    params: { timeframe },
  });

  return data;
};

/**
 * 종목 리스트 조회
 */
export const getStockList = async (): Promise<GetStockListResponseDto> => {
  const { data } = await apiClient.get<GetStockListResponseDto>(`/stocks/list`);
  return data;
};

/**
 * 종목 자동완성 검색 (symbol 또는 name 부분 일치, prefix 우선 랭킹)
 */
export const searchStocks = async (q: string, limit = 20): Promise<SearchStocksResponseDto> => {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const { data } = await apiClient.get<SearchStocksResponseDto>(`/stocks/search`, {
    params: { q: trimmed, limit },
  });
  return data;
};
