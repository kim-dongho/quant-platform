import { apiClient } from '@/shared/api/client';

import type { LiveStrategy, LiveStrategyInput, StopResponse, UpsertResponse } from '../model/types';

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
