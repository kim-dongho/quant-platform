// 탐색 진행률 표시 — done/total 기반 progress bar + 현재 평가중인 룰 + ETA.
const fmtSeconds = (s: number): string => {
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}분 ${sec}초`;
};

export const DiscoverProgress = ({
  done,
  total,
  current,
  startedAt,
  expectedSeconds,
  onCancel,
  cancelling = false,
}: {
  done: number;
  total: number;
  current: string;
  startedAt?: number;
  expectedSeconds: number;
  onCancel?: () => void;
  cancelling?: boolean;
}) => {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const elapsedSec = startedAt ? Math.max(0, Math.round(Date.now() / 1000 - startedAt)) : 0;
  const etaSec =
    done > 0 && elapsedSec > 0
      ? Math.max(0, Math.round((elapsedSec / done) * (total - done)))
      : Math.max(0, expectedSeconds - elapsedSec);

  return (
    <div className="flex flex-col gap-3 py-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-on-surface font-semibold">탐색 진행 중</span>
          <span className="text-on-surface-variant font-mono tabular-nums">
            {done}/{total} ({pct.toFixed(1)}%)
          </span>
        </div>
        <div className="bg-surface-container-low h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="border-outline-variant/30 bg-surface-container-low flex items-center gap-2 rounded-md border px-3 py-2 text-[11px]">
        <span className="material-symbols-outlined text-on-surface-variant text-[14px]">
          {pct < 100 ? 'pending' : 'check'}
        </span>
        <span className="text-on-surface-variant shrink-0">현재 평가:</span>
        <span className="text-on-surface min-w-0 truncate font-mono">{current || '준비 중…'}</span>
      </div>

      <div className="text-on-surface-variant flex justify-between text-[11px]">
        <span>
          경과: <b className="text-on-surface font-mono tabular-nums">{fmtSeconds(elapsedSec)}</b>
        </span>
        <span>
          남은 예상: <b className="text-on-surface font-mono tabular-nums">{fmtSeconds(etaSec)}</b>
        </span>
      </div>

      {onCancel && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="border-error/40 text-error hover:bg-error-container/30 inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            {cancelling ? '취소 중…' : '탐색 취소'}
          </button>
        </div>
      )}
    </div>
  );
};
