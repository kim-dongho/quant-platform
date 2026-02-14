import { apiClient } from '@/shared/api/client';

import {
  GetStockListResponseDto,
  getBacktestResultResponseDto,
  getStockHistoryResponseDto,
} from '../model/stocks-dto';

/**
 * 주식 시세 히스토리 조회
 */
export const getStockHistory = async (symbol: string): Promise<getStockHistoryResponseDto> => {
  const { data } = await apiClient.get<getStockHistoryResponseDto>(`/stocks/${symbol}/history`);

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
 * 백테스트 결과 조회
 */
export const getBacktestResult = async (
  symbol: string,
  params: any,
): Promise<getBacktestResultResponseDto> => {
  const { data } = await apiClient.post<getBacktestResultResponseDto>(`/backtest`, {
    ticker: symbol,
    params: params,
  });

  return data;
};
