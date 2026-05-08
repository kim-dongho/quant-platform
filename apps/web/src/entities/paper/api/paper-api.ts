import { apiClient } from '@/shared/api/client';

import type {
  PaperBalance,
  PaperOrder,
  PaperQuote,
  PlaceOrderRequest,
  PlaceOrderResponse,
} from '../model/types';

// KIS mode 분기 — paper(모의) / real(실투자) 별 별도 키·계좌. 디폴트 paper.
type KisMode = 'paper' | 'real';

export const getPaperBalance = async (mode: KisMode = 'paper'): Promise<PaperBalance> => {
  const { data } = await apiClient.get<PaperBalance>('/paper/balance', { params: { mode } });
  return data;
};

export const getPaperQuote = async (
  symbol: string,
  mode: KisMode = 'paper',
): Promise<PaperQuote> => {
  const { data } = await apiClient.get<PaperQuote>(`/paper/quote/${encodeURIComponent(symbol)}`, {
    params: { mode },
  });
  return data;
};

export const getPaperOrders = async (mode: KisMode = 'paper'): Promise<PaperOrder[]> => {
  const { data } = await apiClient.get<PaperOrder[]>('/paper/orders', { params: { mode } });
  return data ?? [];
};

export const placePaperOrder = async (
  req: PlaceOrderRequest,
  mode: KisMode = 'paper',
): Promise<PlaceOrderResponse> => {
  const { data } = await apiClient.post<PlaceOrderResponse>('/paper/orders', req, {
    params: { mode },
  });
  return data;
};
