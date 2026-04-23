import { apiClient } from '@/shared/api/client';

import type {
  PaperBalance,
  PaperOrder,
  PaperQuote,
  PlaceOrderRequest,
  PlaceOrderResponse,
} from '../model/types';

export const getPaperBalance = async (): Promise<PaperBalance> => {
  const { data } = await apiClient.get<PaperBalance>('/paper/balance');
  return data;
};

export const getPaperQuote = async (symbol: string): Promise<PaperQuote> => {
  const { data } = await apiClient.get<PaperQuote>(`/paper/quote/${encodeURIComponent(symbol)}`);
  return data;
};

export const getPaperOrders = async (): Promise<PaperOrder[]> => {
  const { data } = await apiClient.get<PaperOrder[]>('/paper/orders');
  return data ?? [];
};

export const placePaperOrder = async (req: PlaceOrderRequest): Promise<PlaceOrderResponse> => {
  const { data } = await apiClient.post<PlaceOrderResponse>('/paper/orders', req);
  return data;
};
