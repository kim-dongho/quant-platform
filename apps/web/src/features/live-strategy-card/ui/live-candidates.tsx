'use client';

import { CandidatesTable } from '@/features/portfolio-candidates/ui/candidates-table';

import { useActiveLiveStrategy } from '@/entities/live-strategy/api/live-strategy-queries';
import { useScreenPortfolioQuery } from '@/entities/portfolio/api/portfolio-queries';

/**
 * 활성 전략의 조건으로 실시간 스크리닝한 현재 후보 종목.
 *
 * Phase 36a 에서는 자동 주문 파이프라인이 없어서, 이 목록이 곧바로 체결되진 않는다.
 * "이 전략이라면 지금 이 종목들을 담을 예정"이라는 의미의 미리보기. Phase 36b 에서
 * 스케줄러가 이 결과를 기반으로 KIS 주문을 발사하게 된다.
 */
export const LiveCandidates = () => {
  const { data: strategy } = useActiveLiveStrategy();

  const ruleConfig = strategy
    ? {
        universe: strategy.universe,
        clauses: strategy.clauses,
        max_positions: strategy.max_positions,
      }
    : null;

  const { data, isLoading } = useScreenPortfolioQuery(ruleConfig);

  if (!strategy) return null;

  return <CandidatesTable result={data ?? null} isLoading={isLoading} />;
};
