import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LiveMode } from '../model/types';
import {
  activateLiveStrategy,
  deleteLiveStrategy,
  fetchActiveLiveStrategy,
  fetchAllActiveLiveStrategies,
  fetchLiveRealizedPnL,
  fetchLiveStrategies,
  stopLiveStrategy,
  updateLiveStrategySize,
  upsertLiveStrategy,
} from './live-strategy-api';

export const liveStrategyKeys = {
  all: ['live-strategy'] as const,
  active: (mode: LiveMode = 'paper') => [...liveStrategyKeys.all, 'active', mode] as const,
  activeAll: () => [...liveStrategyKeys.all, 'active', 'all'] as const,
  list: () => [...liveStrategyKeys.all, 'list'] as const,
  realizedPnl: (mode: LiveMode = 'paper') =>
    [...liveStrategyKeys.all, 'realized-pnl', mode] as const,
};

// mode 별 활성 전략 (paper / real 각각)
export const useActiveLiveStrategy = (mode: LiveMode = 'paper') =>
  useQuery({
    queryKey: liveStrategyKeys.active(mode),
    queryFn: () => fetchActiveLiveStrategy(mode),
  });

// 모든 활성 전략 (paper + real, 최대 2개)
export const useAllActiveLiveStrategies = () =>
  useQuery({
    queryKey: liveStrategyKeys.activeAll(),
    queryFn: fetchAllActiveLiveStrategies,
  });

export const useLiveStrategies = () =>
  useQuery({
    queryKey: liveStrategyKeys.list(),
    queryFn: fetchLiveStrategies,
  });

export const useUpsertLiveStrategy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertLiveStrategy,
    onSuccess: () => qc.invalidateQueries({ queryKey: liveStrategyKeys.all }),
  });
};

export const useStopLiveStrategy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: LiveMode = 'paper') => stopLiveStrategy(mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: liveStrategyKeys.all }),
  });
};

export const useActivateLiveStrategy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateLiveStrategy,
    onSuccess: () => qc.invalidateQueries({ queryKey: liveStrategyKeys.all }),
  });
};

export const useDeleteLiveStrategy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLiveStrategy,
    onSuccess: () => qc.invalidateQueries({ queryKey: liveStrategyKeys.all }),
  });
};

export const useUpdateLiveStrategySize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ size, mode = 'paper' }: { size: number; mode?: LiveMode }) =>
      updateLiveStrategySize(size, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: liveStrategyKeys.all }),
  });
};

export const useLiveRealizedPnL = (mode: LiveMode = 'paper') =>
  useQuery({
    queryKey: liveStrategyKeys.realizedPnl(mode),
    queryFn: () => fetchLiveRealizedPnL(mode),
  });
