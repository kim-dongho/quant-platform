import { apiClient } from '@/shared/api/client';
import { BacktestResponseDto } from '../model/stocks-dto';
import { MarketData } from '../model/stocks-common';

/**
 * 백테스트 결과 조회 
 */
export const getBacktestResult = async (symbol: string, params: any): Promise<BacktestResponseDto> => {
  const { data } = await apiClient.post<BacktestResponseDto>(`/backtest`, {
    ticker: symbol,
    params: params
  });

  return data;
};

/**
 * 주식 시세 히스토리 조회
 */
export const getStockHistory = async (symbol: string): Promise<MarketData[]> => {
  // apiClient에 기본적으로 /api가 붙어있다면 '/stocks/...'로 사용하세요.
  const { data } = await apiClient.get<MarketData[]>(`/stocks/${symbol}/history`);
  
  return data;
};