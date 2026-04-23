import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchActiveLiveStrategy, stopLiveStrategy, upsertLiveStrategy } from './live-strategy-api';

export const liveStrategyKeys = {
  all: ['live-strategy'] as const,
  active: () => [...liveStrategyKeys.all, 'active'] as const,
};

export const useActiveLiveStrategy = () =>
  useQuery({
    queryKey: liveStrategyKeys.active(),
    queryFn: fetchActiveLiveStrategy,
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
