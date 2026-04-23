import { useMutation, useQuery } from '@tanstack/react-query';

import type { RuleConfig } from '../model/types';
import { backtestPortfolio, screenPortfolio } from './portfolio-api';

export const useScreenPortfolio = () =>
  useMutation({
    mutationFn: screenPortfolio,
  });

export const useBacktestPortfolio = () =>
  useMutation({
    mutationFn: backtestPortfolio,
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
