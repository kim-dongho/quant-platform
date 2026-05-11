'use client';

import { useState } from 'react';

import { getDiscoverRun } from '@/entities/portfolio/api/portfolio-api';
import {
  useCancelDiscover,
  useDiscoverJobStatus,
  useStartDiscover,
} from '@/entities/portfolio/api/portfolio-queries';
import type {
  Clause,
  DiscoverJobState,
  DiscoverResult,
  ExitPolicy,
  FactorKey,
  RuleConfig,
} from '@/entities/portfolio/model/types';

import { calcCombinations } from '../lib/calc-combinations';
import { DEFAULT_SELECTED } from '../model/factor-meta';
import { DiscoverForm } from './discover-form';
import { DiscoverHistory } from './discover-history';
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
  const [showHistory, setShowHistory] = useState(false);
  // DB 에서 복원한 과거 결과 — jobId 없이도 결과 화면 띄울 수 있게.
  const [historyResult, setHistoryResult] = useState<DiscoverResult | null>(null);

  const startMutation = useStartDiscover();
  const cancelMutation = useCancelDiscover();
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
    setHistoryResult(null);
    startMutation.reset();
    cancelMutation.reset();
  };

  // 이력에서 한 건 선택 — params 로 form 채우고 result 복원해 바로 결과 화면 표시.
  const loadHistory = async (id: number) => {
    const run = await getDiscoverRun(id);
    setUniverse(run.params.universe);
    setNClauses((run.params.n_clauses ?? 1) as 1 | 2);
    setMaxPositions(run.params.max_positions ?? defaults.max_positions);
    setTopN(run.params.top_n ?? 5);
    if (run.params.factors && run.params.factors.length > 0) {
      setSelectedFactors(new Set(run.params.factors));
    }
    setHistoryResult(run.result);
    setShowHistory(false);
  };

  // 닫으면 항상 처음 form 으로 — 다음 열 때 직전 결과·진행 화면 그대로 두지 않고 새로
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCancel = () => {
    if (!jobId) return;
    cancelMutation.mutate(jobId);
  };

  const factorCount = selectedFactors.size;
  const combos = calcCombinations(factorCount, nClauses);
  // 1조합 ~150ms (1-clause), 2-clause는 같은 단위 시간이지만 조합 더 많음. (train+test 합산)
  const expectedSeconds = Math.max(15, Math.round((combos * 0.15 * 2) / 1));

  const isRunning = !!jobId && (!job || job.status === 'running');
  // cancelled 상태일 때도 부분 결과(평가된 조합) 를 그대로 표시 — 사용자가 의도적으로 끊은
  // 것이니 done 과 동일하게 처리. 또는 이력에서 복원한 historyResult.
  const result =
    job?.status === 'done' || job?.status === 'cancelled'
      ? job.result
      : (historyResult ?? undefined);
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
            onClick={handleClose}
            className="text-on-surface-variant hover:bg-surface-container-low h-7 w-7 rounded-md"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {!jobId && !startMutation.isPending && !result && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-surface-container-low inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium"
              >
                <span className="material-symbols-outlined text-[14px]">history</span>
                최근 탐색
              </button>
            </div>
          )}

          {showHistory && !jobId && !result && (
            <DiscoverHistory onSelect={loadHistory} onClose={() => setShowHistory(false)} />
          )}

          {!jobId && !startMutation.isPending && !result && !showHistory && (
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
              onCancel={jobId ? handleCancel : undefined}
              cancelling={cancelMutation.isPending || !!cancelMutation.data}
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
                handleClose();
              }}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
};
