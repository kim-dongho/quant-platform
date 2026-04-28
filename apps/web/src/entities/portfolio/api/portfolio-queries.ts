import { useMutation, useQuery } from '@tanstack/react-query';

import type { DiscoverJobState, RuleConfig } from '../model/types';
import {
  backtestPortfolio,
  discoverStrategies,
  getDiscoverStatus,
  screenPortfolio,
  startDiscover,
} from './portfolio-api';

export const useScreenPortfolio = () =>
  useMutation({
    mutationFn: screenPortfolio,
  });

export const useBacktestPortfolio = () =>
  useMutation({
    mutationFn: backtestPortfolio,
  });

export const useDiscoverStrategies = () =>
  useMutation({
    mutationFn: discoverStrategies,
  });

export const useStartDiscover = () =>
  useMutation({
    mutationFn: startDiscover,
  });

/** job_id가 있으면 1초마다 status polling. status === 'running'이 아니면 polling 중단. */
export const useDiscoverJobStatus = (jobId: string | null) =>
  useQuery<DiscoverJobState>({
    queryKey: ['discoverStatus', jobId],
    queryFn: () => getDiscoverStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 1000 : false),
    // 완료된 결과는 사용자가 다시 켤 때까지 캐시
    staleTime: 0,
  });

/**
 * 라이브 전략의 현재 후보 종목을 조회하기 위한 쿼리 버전.
 * config 가 null/undefined 면 쿼리 비활성화.
 */
export const useScreenPortfolioQuery = (config: RuleConfig | null | undefined) =>
  useQuery({
    queryKey: ['portfolioScreen', config],
    queryFn: () => screenPortfolio(config as RuleConfig),
    enabled: !!config && config.clauses.length > 0,
    staleTime: 60_000, // 1분 — 장중엔 가끔 갱신되어도 충분
  });
