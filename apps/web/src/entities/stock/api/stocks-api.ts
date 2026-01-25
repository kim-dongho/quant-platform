import { apiClient } from '@/shared/api/client';
import { getBacktestResultResponseDto, getStockHistoryResponseDto } from '../model/stocks-dto';

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
export const getStockHistory = async (symbol: string): Promise<getStockHistoryResponseDto> => {
  const { data } = await apiClient.get<getStockHistoryResponseDto>(`/stocks/${symbol}/history`);
  
  return data;
};