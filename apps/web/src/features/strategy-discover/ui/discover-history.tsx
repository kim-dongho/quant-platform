'use client';

import { useDeleteDiscoverRun, useDiscoverRuns } from '@/entities/portfolio/api/portfolio-queries';
import { UNIVERSE_OPTIONS, getFactorLabel } from '@/entities/portfolio/model/factors';
import type { DiscoverRunSummary } from '@/entities/portfolio/model/types';

// 최근 탐색 이력 패널 — DiscoverDialog 안 form 단계에서 펼침.
// 클릭하면 onSelect 로 run id 전달, dialog 가 상세 가져와 결과 화면 복원.
export const DiscoverHistory = ({
  onSelect,
  onClose,
}: {
  onSelect: (id: number) => void;
  onClose: () => void;
}) => {
  const { data: runs, isLoading } = useDiscoverRuns({ limit: 30 });
  const remove = useDeleteDiscoverRun();

  return (
    <div className="border-outline-variant/40 bg-surface-container-low flex max-h-[55vh] flex-col rounded-lg border">
      <div className="border-outline-variant/30 flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[16px]">history</span>
          <span className="text-on-surface text-[13px] font-semibold">
            최근 탐색{' '}
            <span className="text-on-surface-variant font-normal">({runs?.length ?? 0})</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-on-surface-variant hover:bg-surface-container h-6 w-6 rounded"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="text-on-surface-variant py-6 text-center text-xs">로딩…</div>
        ) : !runs || runs.length === 0 ? (
          <div className="text-on-surface-variant border-outline-variant/40 rounded-md border border-dashed py-6 text-center text-xs">
            저장된 탐색 이력이 없습니다 — 탐색을 한 번 완료하면 자동으로 누적됩니다
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {runs.map((run) => (
              <HistoryRow
                key={run.id}
                run={run}
                onSelect={() => onSelect(run.id)}
                onDelete={() => {
                  if (confirm(`${formatDate(run.created_at)} 탐색 이력을 삭제할까요?`)) {
                    remove.mutate(run.id);
                  }
                }}
                busy={remove.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const HistoryRow = ({
  run,
  onSelect,
  onDelete,
  busy,
}: {
  run: DiscoverRunSummary;
  onSelect: () => void;
  onDelete: () => void;
  busy: boolean;
}) => {
  const universeLabel =
    UNIVERSE_OPTIONS.find((o) => o.value === run.universe)?.label ?? run.universe;
  const factors = run.params.factors ?? [];
  const factorText =
    factors.length === 0
      ? '(기본 factor)'
      : factors.slice(0, 4).map(getFactorLabel).join(', ') +
        (factors.length > 4 ? ` 외 ${factors.length - 4}` : '');
  const top = run.top_summary?.[0];
  const sharpe = top?.test_sharpe ?? top?.train_sharpe;
  const cagr = top?.test_cagr ?? top?.train_cagr;

  return (
    <article className="border-outline-variant/30 bg-surface hover:border-primary/40 flex items-center gap-3 rounded-md border px-3 py-2 transition-colors">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-on-surface font-semibold">{universeLabel}</span>
          <span className="text-on-surface-variant">·</span>
          <span className="text-on-surface-variant">
            {run.params.n_clauses}-clause · top {run.params.top_n}
          </span>
          <span className="text-on-surface-variant ml-auto text-[10.5px]">
            {formatDate(run.created_at)}
          </span>
        </div>
        <div className="text-on-surface-variant truncate text-[11px]">{factorText}</div>
        {top && (
          <div className="text-on-surface-variant flex items-center gap-3 text-[11px]">
            <span>
              1등 sharpe{' '}
              <span className="text-on-surface font-medium">{sharpe?.toFixed(2) ?? '–'}</span>
            </span>
            <span>
              CAGR <span className="text-on-surface font-medium">{formatPct(cagr)}</span>
            </span>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label="삭제"
        className="text-on-surface-variant hover:bg-error-container hover:text-error h-6 w-6 shrink-0 rounded transition-colors disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-[14px]">delete</span>
      </button>
    </article>
  );
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
};

const formatPct = (v: number | undefined): string => (v == null ? '–' : `${(v * 100).toFixed(1)}%`);
