'use client';

import Link from 'next/link';

import {
  useActiveLiveStrategy,
  useStopLiveStrategy,
} from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveStrategy } from '@/entities/live-strategy/model/types';
import { UNIVERSE_OPTIONS, getFactorLabel } from '@/entities/portfolio/model/factors';
import type { ExitPolicy } from '@/entities/portfolio/model/types';

import { useConfirm } from '@/shared/ui/dialog/dialog-provider';

export const ActiveStrategyCard = () => {
  const { data: strategy, isLoading } = useActiveLiveStrategy();
  const stop = useStopLiveStrategy();
  const confirm = useConfirm();

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!strategy) {
    return <EmptyCard />;
  }

  const handleStop = async () => {
    const ok = await confirm({
      title: `'${strategy.name}' 전략을 중지합니다`,
      description: '중지 후에도 언제든 전략 페이지에서 다시 활성화할 수 있습니다.',
      tone: 'danger',
      confirmText: '중지',
      cancelText: '취소',
      icon: 'pause',
    });
    if (ok) stop.mutate();
  };

  return <StrategyCard strategy={strategy} onStop={handleStop} stopping={stop.isPending} />;
};

// ---------------------------------------------------------------------------
// 서브 컴포넌트
// ---------------------------------------------------------------------------

const SkeletonCard = () => (
  <div className="border-outline-variant/40 bg-surface-container-lowest rounded-xl border p-4">
    <div className="bg-surface-container-low h-5 w-40 animate-pulse rounded" />
    <div className="bg-surface-container-low mt-3 h-3 w-64 animate-pulse rounded" />
  </div>
);

const EmptyCard = () => (
  <div className="border-outline-variant/40 bg-surface-container-lowest flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">bolt</span>
      <div>
        <div className="text-on-surface text-sm font-semibold">활성 전략이 없습니다</div>
        <div className="text-on-surface-variant mt-0.5 text-xs">
          전략 페이지에서 만든 룰을 라이브로 활성화해보세요
        </div>
      </div>
    </div>
    <Link
      href="/portfolio"
      className="border-outline-variant/60 bg-surface text-on-surface hover:bg-surface-container-low flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
    >
      전략 페이지로
      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
    </Link>
  </div>
);

interface StrategyCardProps {
  strategy: LiveStrategy;
  onStop: () => void;
  stopping: boolean;
}

const StrategyCard = ({ strategy, onStop, stopping }: StrategyCardProps) => {
  const universeLabel =
    UNIVERSE_OPTIONS.find((o) => o.value === strategy.universe)?.label ?? strategy.universe;
  const clauseText =
    strategy.clauses.length > 0
      ? strategy.clauses.map((c) => `${getFactorLabel(c.factor)} ${c.op} ${c.value}`).join(', ')
      : '(없음)';
  const exitText = formatExit(strategy.exit_policy);
  const lastRebalance = strategy.last_rebalance_at
    ? new Date(strategy.last_rebalance_at).toLocaleString('ko-KR')
    : '—';

  return (
    <div className="border-primary/30 from-primary-fixed/30 to-surface-container-lowest rounded-xl border bg-gradient-to-br p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-on-primary flex h-7 w-7 items-center justify-center rounded-full">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
          </span>
          <div>
            <div className="text-on-surface text-[15px] font-semibold">{strategy.name}</div>
            <div className="text-on-surface-variant text-[11px]">
              {universeLabel} · 라이브 실행 중
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/portfolio"
            className="border-outline-variant/60 bg-surface text-on-surface hover:bg-surface-container-low rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
          >
            수정
          </Link>
          <button
            type="button"
            onClick={onStop}
            disabled={stopping}
            className="border-error/40 bg-error-container/60 text-error hover:bg-error-container flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">pause</span>
            {stopping ? '중지 중…' : '중지'}
          </button>
        </div>
      </div>

      <div className="border-outline-variant/30 mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 border-t pt-3 text-[12px] sm:grid-cols-2">
        <Row label="진입 조건" value={clauseText} />
        <Row label="청산" value={exitText} />
        <Row label="최대 보유" value={`${strategy.max_positions}종목`} />
        <Row label="종목당 배분" value={`₩${strategy.position_size_krw.toLocaleString()}`} />
        <Row label="마지막 리밸런싱" value={lastRebalance} />
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-2">
    <span className="text-on-surface-variant w-[76px] shrink-0">{label}</span>
    <span className="text-on-surface flex-1 break-words">{value}</span>
  </div>
);

const formatExit = (p: ExitPolicy | null): string => {
  if (!p) return '(없음)';
  const parts: string[] = [];
  if (p.stop_loss_pct != null) parts.push(`손절 ${p.stop_loss_pct}%`);
  if (p.take_profit_pct != null) parts.push(`익절 +${p.take_profit_pct}%`);
  if (p.trailing_stop_pct != null) parts.push(`트레일링 ${p.trailing_stop_pct}%`);
  if (p.time_exit_days != null) parts.push(`${p.time_exit_days}일 종료`);
  return parts.length > 0 ? parts.join(', ') : '(없음)';
};
