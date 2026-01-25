import { apiClient } from '@/shared/api/client';
import { getBacktestResultResponseDto } from '../model/stocks-dto';
import { MarketData } from '../model/stocks-common';

/**
 * 백테스트 결과 조회 
 */
export const getBacktestResult = async (symbol: string, params: any): Promise<getBacktestResultResponseDto> => {
  const { data } = await apiClient.post<getBacktestResultResponseDto>(`/backtest`, {
    ticker: symbol,
    params: params
  });

  return data;
};

/**
 * 주식 시세 히스토리 조회
 */
export const getStockHistory = async (symbol: string): Promise<MarketData[]> => {
  const { data } = await apiClient.get<MarketData[]>(`/stocks/${symbol}/history`);
  
  return data;
};