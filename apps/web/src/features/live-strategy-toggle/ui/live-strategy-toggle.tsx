'use client';

import { useState } from 'react';

import {
  useActiveLiveStrategy,
  useStopLiveStrategy,
  useUpsertLiveStrategy,
} from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveStrategy } from '@/entities/live-strategy/model/types';
import { UNIVERSE_OPTIONS, getFactorLabel } from '@/entities/portfolio/model/factors';
import type { ExitPolicy, RuleConfig } from '@/entities/portfolio/model/types';

import { ActivateDialog } from './activate-dialog';

interface Props {
  config: RuleConfig;
  exitPolicy: ExitPolicy | null;
  disabled?: boolean;
}

/**
 * /portfolio 헤더에 노출되는 라이브 활성화 토글.
 *
 * 상태 3가지:
 *  - 활성 전략 없음                                → [⚡ 라이브 활성화]
 *  - 활성 전략 있고 현재 config 와 동일            → [⏸ 라이브 중지 (전략명)]
 *  - 활성 전략 있고 현재 config 와 다름            → [⚡ 라이브 교체 (기존: 전략명)]
 */
export const LiveStrategyToggle = ({ config, exitPolicy, disabled }: Props) => {
  const { data: active } = useActiveLiveStrategy();
  const stop = useStopLiveStrategy();
  const [dialogOpen, setDialogOpen] = useState(false);

  const same = active ? isSameStrategy(active, config, exitPolicy) : false;
  const hasActive = !!active;

  if (stop.isPending || stop.isSuccess === false) {
    // pending 표시는 버튼 아래에서 처리. isSuccess 가 false 인 상태는 에러일 수도.
  }

  if (hasActive && same) {
    return (
      <button
        type="button"
        onClick={() => stop.mutate()}
        disabled={stop.isPending}
        className="border-error/40 bg-error-container/40 text-error hover:bg-error-container/60 flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        title={`현재 이 전략이 라이브로 실행 중입니다 (id ${active.id})`}
      >
        <span className="material-symbols-outlined text-[16px]">pause</span>
        {stop.isPending ? '중지 중…' : `라이브 중지 (${active.name})`}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={disabled || config.clauses.length === 0}
        className={[
          'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50',
          hasActive
            ? 'border-tertiary/50 bg-tertiary-container text-on-tertiary-container hover:bg-tertiary-container/80 border'
            : 'border-outline-variant/60 bg-surface text-on-surface hover:bg-surface-container-low border',
        ].join(' ')}
        title={
          hasActive
            ? `현재 '${active.name}'이 실행 중. 활성화 시 자동 교체됩니다`
            : '이 전략을 모의계좌에 활성화합니다'
        }
      >
        <span className="material-symbols-outlined text-[16px]">bolt</span>
        {hasActive ? `라이브 교체 (기존: ${active.name})` : '라이브 활성화'}
      </button>
      {dialogOpen && (
        <ActivateDialog
          config={config}
          exitPolicy={exitPolicy}
          existing={active ?? null}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// 동일성 판정: universe, clauses, max_positions, exit_policy 비교
// 초기 구현은 JSON.stringify 기반 단순 비교. clause 순서가 바뀌면 다른 것으로 간주하지만
// 사용자가 의도적으로 재배열한 경우라 실용상 큰 문제 없음.
// ---------------------------------------------------------------------------
const isSameStrategy = (
  active: LiveStrategy,
  config: RuleConfig,
  exitPolicy: ExitPolicy | null,
): boolean => {
  if (active.universe !== config.universe) return false;
  if (active.max_positions !== config.max_positions) return false;
  if (JSON.stringify(active.clauses) !== JSON.stringify(config.clauses)) return false;
  const a = normalizeExitPolicy(active.exit_policy);
  const b = normalizeExitPolicy(exitPolicy);
  return JSON.stringify(a) === JSON.stringify(b);
};

const normalizeExitPolicy = (p: ExitPolicy | null) => {
  if (!p) return null;
  // null vs undefined 일관성 + signal_exit_clauses 빈 배열 통일
  return {
    stop_loss_pct: p.stop_loss_pct ?? null,
    take_profit_pct: p.take_profit_pct ?? null,
    trailing_stop_pct: p.trailing_stop_pct ?? null,
    time_exit_days: p.time_exit_days ?? null,
    signal_exit_clauses: p.signal_exit_clauses ?? [],
  };
};

export const getUniverseLabel = (value: string): string =>
  UNIVERSE_OPTIONS.find((o) => o.value === value)?.label ?? value;

export const formatClauseList = (clauses: RuleConfig['clauses']): string =>
  clauses.map((c) => `${getFactorLabel(c.factor)} ${c.op} ${c.value}`).join(' AND ');
