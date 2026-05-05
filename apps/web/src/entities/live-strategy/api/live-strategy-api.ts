import { apiClient } from '@/shared/api/client';

import type {
  LiveRealizedPnL,
  LiveStrategy,
  LiveStrategyInput,
  StopResponse,
  UpsertResponse,
} from '../model/types';

export const fetchActiveLiveStrategy = async (): Promise<LiveStrategy | null> => {
  const { data } = await apiClient.get<LiveStrategy | null>('/live/strategy');
  return data;
};

export const upsertLiveStrategy = async (input: LiveStrategyInput): Promise<UpsertResponse> => {
  const { data } = await apiClient.post<UpsertResponse>('/live/strategy', input);
  return data;
};

export const stopLiveStrategy = async (): Promise<StopResponse> => {
  const { data } = await apiClient.delete<StopResponse>('/live/strategy');
  return data;
};

export const updateLiveStrategySize = async (positionSizeKrw: number): Promise<LiveStrategy> => {
  const { data } = await apiClient.patch<LiveStrategy>('/live/strategy', {
    position_size_krw: positionSizeKrw,
  });
  return data;
};

export const fetchLiveStrategies = async (): Promise<LiveStrategy[]> => {
  const { data } = await apiClient.get<LiveStrategy[]>('/live/strategies');
  return data;
};

export const activateLiveStrategy = async (id: number): Promise<UpsertResponse> => {
  const { data } = await apiClient.post<UpsertResponse>(`/live/strategies/${id}/activate`);
  return data;
};

export const deleteLiveStrategy = async (id: number): Promise<{ deleted: boolean }> => {
  const { data } = await apiClient.delete<{ deleted: boolean }>(`/live/strategies/${id}`);
  return data;
};

export const fetchLiveRealizedPnL = async (): Promise<LiveRealizedPnL> => {
  const { data } = await apiClient.get<LiveRealizedPnL>('/live/realized-pnl');
  return data;
};
