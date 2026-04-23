'use client';

import { useEffect, useRef, useState } from 'react';

import { useUpsertLiveStrategy } from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveStrategy } from '@/entities/live-strategy/model/types';
import type { ExitPolicy, RuleConfig } from '@/entities/portfolio/model/types';

import { useAlert } from '@/shared/ui/dialog/dialog-provider';

import { formatClauseList, getUniverseLabel } from './live-strategy-toggle';

interface Props {
  config: RuleConfig;
  exitPolicy: ExitPolicy | null;
  existing: LiveStrategy | null;
  onClose: () => void;
}

const DEFAULT_NAME = '기본 전략';
const DEFAULT_POSITION_SIZE = 1_000_000;

export const ActivateDialog = ({ config, exitPolicy, existing, onClose }: Props) => {
  const [name, setName] = useState(existing?.name || DEFAULT_NAME);
  const [positionSize, setPositionSize] = useState<number>(
    existing?.position_size_krw ?? DEFAULT_POSITION_SIZE,
  );
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertLiveStrategy();
  const alert = useAlert();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = () => {
    setError(null);
    const trimmed = name.trim() || DEFAULT_NAME;
    if (positionSize < 10_000) {
      setError('종목당 배분 금액은 최소 10,000원 이상이어야 합니다');
      return;
    }
    upsert.mutate(
      {
        name: trimmed,
        universe: config.universe,
        clauses: config.clauses,
        max_positions: config.max_positions,
        exit_policy: exitPolicy,
        position_size_krw: positionSize,
      },
      {
        onSuccess: (data) => {
          onClose();
          void alert({
            title: data.replaced
              ? `'${data.replaced.name}' 중지 → '${data.name}' 활성화됨`
              : `'${data.name}' 이 활성화되었습니다`,
            description:
              '이 전략은 현재 상태 저장소에 기록되었습니다. 자동 매매 파이프라인은 다음 단계에서 추가됩니다.',
            icon: 'bolt',
          });
        },
        onError: (e: unknown) => {
          const msg = e instanceof Error ? e.message : '활성화 실패';
          setError(msg);
        },
      },
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest w-full max-w-lg overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="bg-primary-fixed text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </div>
          <h2 className="text-on-surface flex-1 pt-1.5 text-[18px] leading-tight font-semibold">
            라이브 활성화
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 pb-6">
          <div>
            <label className="text-on-surface-variant mb-1.5 block text-xs font-medium">
              전략명
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-outline-variant bg-surface text-on-surface focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder={DEFAULT_NAME}
              maxLength={60}
            />
          </div>

          {/* 전략 요약 */}
          <div className="border-outline-variant/40 bg-surface-container-low/60 rounded-lg border px-4 py-3 text-sm">
            <SummaryRow label="유니버스" value={getUniverseLabel(config.universe)} />
            <SummaryRow
              label="진입 조건"
              value={config.clauses.length ? formatClauseList(config.clauses) : '(없음)'}
            />
            <SummaryRow label="최대 보유" value={`${config.max_positions}종목`} />
            <SummaryRow label="청산" value={formatExitPolicy(exitPolicy)} />
          </div>

          <div>
            <label className="text-on-surface-variant mb-1.5 block text-xs font-medium">
              종목당 배분 금액 (원)
            </label>
            <input
              type="number"
              min={10000}
              step={100000}
              value={positionSize}
              onChange={(e) => setPositionSize(Number(e.target.value) || 0)}
              className="border-outline-variant bg-surface text-on-surface focus:border-primary w-full rounded-lg border px-3 py-2 text-right font-mono text-sm tabular-nums outline-none"
            />
            <p className="text-on-surface-variant mt-1 text-[11px]">
              최대 ₩{(positionSize * config.max_positions).toLocaleString()} 까지 사용됩니다
            </p>
          </div>

          {existing && (
            <div className="border-error/30 bg-error-container/30 text-on-error-container rounded-lg border px-4 py-3 text-xs">
              <span className="material-symbols-outlined text-error mr-1 align-middle text-[14px]">
                warning
              </span>
              현재 <strong>‘{existing.name}’</strong> 전략이 실행 중입니다. 활성화 시 자동으로
              중지되고 새 전략으로 교체됩니다.
            </div>
          )}

          {error && (
            <div className="border-error/40 bg-error-container/40 text-error rounded-lg border px-3 py-2 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-outline-variant/30 bg-surface-container-low/60 flex justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={upsert.isPending}
            className="border-outline-variant/60 bg-surface text-on-surface hover:bg-surface-container-low min-w-[100px] rounded-lg border px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={upsert.isPending}
            className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant min-w-[100px] rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {upsert.isPending ? '활성화 중…' : '활성화'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-3 py-1">
    <span className="text-on-surface-variant w-[68px] shrink-0 text-xs">{label}</span>
    <span className="text-on-surface flex-1 text-xs leading-relaxed break-words">{value}</span>
  </div>
);

const formatExitPolicy = (p: ExitPolicy | null): string => {
  if (!p) return '(없음)';
  const parts: string[] = [];
  if (p.stop_loss_pct != null) parts.push(`손절 ${p.stop_loss_pct}%`);
  if (p.take_profit_pct != null) parts.push(`익절 +${p.take_profit_pct}%`);
  if (p.trailing_stop_pct != null) parts.push(`트레일링 ${p.trailing_stop_pct}%`);
  if (p.time_exit_days != null) parts.push(`${p.time_exit_days}일 종료`);
  if (p.signal_exit_clauses && p.signal_exit_clauses.length > 0) {
    parts.push(`시그널 종료(${p.signal_exit_clauses.length})`);
  }
  return parts.length > 0 ? parts.join(', ') : '(없음)';
};
