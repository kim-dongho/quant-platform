'use client';

import type { IngestStatus } from '@/entities/portfolio/model/types';

interface Props {
  status: IngestStatus | undefined;
  onDismiss?: () => void;
}

export const IngestProgressBanner = ({ status, onDismiss }: Props) => {
  if (!status || status.status === 'idle') return null;

  const isRunning = status.status === 'running';
  const completed = status.completed ?? 0;
  const total = status.total ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const succeeded = status.succeeded ?? 0;
  const failed = status.failed ?? 0;
  const current = status.current;

  return (
    <div
      className={`flex items-center gap-4 border-b px-6 py-3 text-xs ${
        isRunning
          ? 'border-outline-variant/30 bg-primary-fixed/30 text-on-primary-fixed'
          : 'border-outline-variant/30 bg-secondary-container/30 text-on-secondary-container'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">
        {isRunning ? 'cloud_download' : 'check_circle'}
      </span>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {isRunning
              ? `${status.universe} 수집 중 — ${completed}/${total}${current ? ` (${current})` : ''}`
              : `${status.universe} 수집 완료 — ${succeeded} 성공${failed ? ` · ${failed} 실패` : ''}`}
          </span>
          <span className="font-mono tabular-nums opacity-70">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-outline-variant/30">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              isRunning ? 'bg-primary' : 'bg-secondary'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!isRunning && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
};
