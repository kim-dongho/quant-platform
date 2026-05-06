import type { Clause, DiscoverResult } from '@/entities/portfolio/model/types';

import { DiscoverResultCard } from './discover-result-card';

// 탐색 완료 후 상위 N개 룰 결과 영역.
export const DiscoverResults = ({
  result,
  onApply,
  onReset,
}: {
  result: DiscoverResult;
  onApply: (clauses: Clause[]) => void;
  onReset: () => void;
}) => (
  <>
    {result.cancelled && (
      <div className="border-warning/40 bg-warning-container/30 text-on-warning-container flex items-center gap-2 rounded-md border px-3 py-2 text-[11px]">
        <span className="material-symbols-outlined text-[14px]">info</span>
        <span>
          탐색이 취소되었습니다. 지금까지 평가된 <b>{result.evaluated}</b>개 결과만 표시됩니다.
        </span>
      </div>
    )}

    <div className="border-outline-variant/30 bg-surface-container-low flex items-center justify-between rounded-md border px-3 py-2">
      <div className="text-on-surface-variant text-[11px]">
        평가 {result.evaluated} · 제외 {result.skipped} · 학습 기간{' '}
        {result.params.train_period.join(' ~ ')} · 검증 기간 {result.params.test_period.join(' ~ ')}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="text-primary hover:bg-surface-container hover:text-on-primary-fixed-variant rounded-md px-2 py-1 text-[11px]"
      >
        다시 탐색
      </button>
    </div>

    {result.top.length === 0 ? (
      <div className="border-outline-variant/40 text-on-surface-variant rounded-md border border-dashed py-10 text-center text-xs">
        {result.cancelled
          ? '평가가 너무 일찍 취소돼 결과가 없습니다 — 다시 시도해보세요.'
          : '평가 가능한 룰이 없습니다 — 다른 투자 대상이나 조건 개수를 바꿔서 다시 시도해보세요.'}
      </div>
    ) : (
      <>
        <div className="border-outline-variant/30 bg-surface-container-low text-on-surface-variant flex flex-col gap-1.5 rounded-md border px-3 py-2 text-[11px] leading-relaxed">
          <div>
            <span className="font-semibold">정렬 기준:</span>{' '}
            <span title="학습 기간 α와 검증 기간 α를 더해 2로 나눈 값. 한쪽만 좋은 룰(우연·과적합 의심)을 걸러내기 위함">
              <b className="text-on-surface">학습·검증 α 평균</b>의 내림차순으로 순위를 산정합니다
            </span>{' '}
            <span className="cursor-help">ⓘ</span>
          </div>
          <div className="border-outline-variant/30 border-t pt-1.5">
            <span className="font-semibold">품질 배지:</span>{' '}
            <span className="bg-success-container text-on-success-container ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              양호
            </span>{' '}
            학습·검증 모두 시장 초과 ·{' '}
            <span className="bg-warning-container text-on-warning-container ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              보통
            </span>{' '}
            한쪽만 시장 초과 ·{' '}
            <span className="bg-danger-container text-on-danger-container ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              약함
            </span>{' '}
            시장보다 못함
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {result.top.map((row, i) => (
            <DiscoverResultCard
              key={i}
              rank={i + 1}
              row={row}
              onApply={() => onApply(row.clauses)}
            />
          ))}
        </div>
      </>
    )}
  </>
);
