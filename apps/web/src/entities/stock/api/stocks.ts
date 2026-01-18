import { apiClient } from '@/shared/api/client';
import { MarketData } from '../model/types';

export const getStockHistory = async (symbol: string): Promise<MarketData[]> => {
  const { data } = await apiClient.get<MarketData[]>(`/api/stocks/${symbol}/history`);
  return data;
};