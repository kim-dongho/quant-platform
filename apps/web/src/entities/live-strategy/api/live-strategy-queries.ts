import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  activateLiveStrategy,
  deleteLiveStrategy,
  fetchActiveLiveStrategy,
  fetchLiveRealizedPnL,
  fetchLiveStrategies,
  stopLiveStrategy,
  updateLiveStrategySize,
  upsertLiveStrategy,
} from './live-strategy-api';

export const liveStrategyKeys = {
  all: ['live-strategy'] as const,
  active: () => [...liveStrategyKeys.all, 'active'] as const,
  list: () => [...liveStrategyKeys.all, 'list'] as const,
  realizedPnl: () => [...liveStrategyKeys.all, 'realized-pnl'] as const,
};

export const useActiveLiveStrategy = () =>
  useQuery({
    queryKey: liveStrategyKeys.active(),
    queryFn: fetchActiveLiveStrategy,
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
    mutationFn: stopLiveStrategy,
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
    mutationFn: updateLiveStrategySize,
    onSuccess: () => qc.invalidateQueries({ queryKey: liveStrategyKeys.all }),
  });
};

export const useLiveRealizedPnL = () =>
  useQuery({
    queryKey: liveStrategyKeys.realizedPnl(),
    queryFn: fetchLiveRealizedPnL,
  });
