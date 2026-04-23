import { useMutation, useQuery } from '@tanstack/react-query';

import {
  backtestPortfolio,
  getIngestStatus,
  ingestUniverse,
  screenPortfolio,
} from './portfolio-api';

export const useScreenPortfolio = () =>
  useMutation({
    mutationFn: screenPortfolio,
  });

export const useBacktestPortfolio = () =>
  useMutation({
    mutationFn: backtestPortfolio,
  });

export const useIngestUniverse = () =>
  useMutation({
    mutationFn: ingestUniverse,
  });

/**
 * 수집 진행 상태 폴링.
 * enabled=true일 때 2초마다 폴링, status가 done/idle이면 자동 중단.
 */
export const useIngestStatus = (universe: string, enabled: boolean) =>
  useQuery({
    queryKey: ['ingestStatus', universe],
    queryFn: () => getIngestStatus(universe),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 2000 : false;
    },
    refetchIntervalInBackground: false,
  });
