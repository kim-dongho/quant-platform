'use client';

import { useState } from 'react';

import { useDiscoverJobStatus, useStartDiscover } from '@/entities/portfolio/api/portfolio-queries';
import type {
  Clause,
  DiscoverJobState,
  ExitPolicy,
  FactorKey,
  RuleConfig,
} from '@/entities/portfolio/model/types';

import { calcCombinations } from '../lib/calc-combinations';
import { DEFAULT_SELECTED } from '../model/factor-meta';
import { DiscoverForm } from './discover-form';
import { DiscoverProgress } from './discover-progress';
import { DiscoverResults } from './discover-results';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 탐색 시 기본값으로 채울 universe / max_positions */
  defaults: Pick<RuleConfig, 'universe' | 'max_positions'>;
  exitPolicy: ExitPolicy | null;
  /** 결과 카드의 "이 룰 적용" 클릭 시 호출 */
  onApply: (clauses: Clause[]) => void;
}

export const DiscoverDialog = ({ open, onClose, defaults, exitPolicy, onApply }: Props) => {
  const [universe, setUniverse] = useState(defaults.universe);
  const [nClauses, setNClauses] = useState<1 | 2>(1);
  const [maxPositions, setMaxPositions] = useState(defaults.max_positions);
  const [topN, setTopN] = useState(5);
  const [selectedFactors, setSelectedFactors] = useState<Set<FactorKey>>(new Set(DEFAULT_SELECTED));
  const [jobId, setJobId] = useState<string | null>(null);

  const startMutation = useStartDiscover();
  const statusQuery = useDiscoverJobStatus(jobId);
  const job: DiscoverJobState | undefined = statusQuery.data;

  if (!open) return null;

  const toggleFactor = (key: FactorKey) => {
    setSelectedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const start = async () => {
    const r = await startMutation.mutateAsync({
      universe,
      factors: Array.from(selectedFactors),
      n_clauses: nClauses,
      top_n: topN,
      max_positions: maxPositions,
      exit_policy: exitPolicy,
    });
    setJobId(r.job_id);
  };

  const reset = () => {
    setJobId(null);
    startMutation.reset();
  };

  const factorCount = selectedFactors.size;
  const combos = calcCombinations(factorCount, nClauses);
  // 1조합 ~150ms (1-clause), 2-clause는 같은 단위 시간이지만 조합 더 많음. (train+test 합산)
  const expectedSeconds = Math.max(15, Math.round((combos * 0.15 * 2) / 1));

  const isRunning = !!jobId && (!job || job.status === 'running');
  const result = job?.status === 'done' ? job.result : undefined;
  const errorMsg =
    startMutation.error?.message ?? (job?.status === 'error' ? job.error : undefined) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-container-lowest border-outline-variant/40 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border shadow-2xl">
        <div className="border-outline-variant/30 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">search</span>
            <h2 className="text-on-surface text-[15px] font-semibold">전략 자동 탐색</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container-low h-7 w-7 rounded-md"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {!jobId && !startMutation.isPending && (
            <DiscoverForm
              universe={universe}
              setUniverse={setUniverse}
              nClauses={nClauses}
              setNClauses={setNClauses}
              maxPositions={maxPositions}
              setMaxPositions={setMaxPositions}
              topN={topN}
              setTopN={setTopN}
              selectedFactors={selectedFactors}
              toggleFactor={toggleFactor}
              expectedSeconds={expectedSeconds}
              combos={combos}
              onStart={start}
            />
          )}

          {(startMutation.isPending || isRunning) && (
            <DiscoverProgress
              done={job?.done ?? 0}
              total={job?.total ?? combos}
              current={job?.current ?? '준비 중…'}
              startedAt={job?.started_at}
              expectedSeconds={expectedSeconds}
            />
          )}

          {errorMsg && (
            <div className="border-error/30 bg-error-container/30 text-error rounded-md border px-3 py-2 text-xs">
              탐색 실패: {errorMsg}
              <button type="button" onClick={reset} className="text-primary ml-2 underline">
                다시 시도
              </button>
            </div>
          )}

          {result && (
            <DiscoverResults
              result={result}
              onApply={(clauses) => {
                onApply(clauses);
                onClose();
              }}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
};
