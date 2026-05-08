'use client';

import {
  useActivateLiveStrategy,
  useDeleteLiveStrategy,
  useLiveStrategies,
} from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveStrategy } from '@/entities/live-strategy/model/types';
import { UNIVERSE_OPTIONS, getFactorLabel } from '@/entities/portfolio/model/factors';
import type { ExitPolicy } from '@/entities/portfolio/model/types';

// 저장된 라이브 전략 라이브러리 모달 — 활성 1개 + 비활성 N개를 상세 정보까지 표시.
// mode 는 prop 으로 받지만, 활성화는 전략 자체의 mode 따라 자동 분류 (다른 mode 의 활성 전략은 안 건드림).
export const StrategyLibraryDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  mode?: 'paper' | 'real';
}) => {
  const { data: strategies, isLoading } = useLiveStrategies();
  const activate = useActivateLiveStrategy();
  const remove = useDeleteLiveStrategy();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-container-lowest border-outline-variant/40 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border shadow-2xl">
        <header className="border-outline-variant/30 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">bookmarks</span>
            <h2 className="text-on-surface text-[15px] font-semibold">
              저장된 전략{' '}
              <span className="text-on-surface-variant font-normal">
                ({strategies?.length ?? 0})
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container-low h-7 w-7 rounded-md"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
          {isLoading || !strategies ? (
            <div className="text-on-surface-variant py-10 text-center text-xs">로딩 중…</div>
          ) : strategies.length === 0 ? (
            <div className="border-outline-variant/40 text-on-surface-variant rounded-md border border-dashed py-10 text-center text-xs">
              저장된 전략이 없습니다 — 전략 페이지에서 활성화하면 자동으로 라이브러리에 쌓입니다
            </div>
          ) : (
            strategies.map((s) => (
              <StrategyDetail
                key={s.id}
                strategy={s}
                onActivate={s.is_active ? undefined : () => activate.mutate(s.id)}
                onDelete={
                  s.is_active
                    ? undefined
                    : () => {
                        if (confirm(`"${s.name}" 전략을 삭제할까요?`)) {
                          remove.mutate(s.id);
                        }
                      }
                }
                busy={activate.isPending || remove.isPending}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 전략 상세 카드
// ─────────────────────────────────────────────────────────────
const StrategyDetail = ({
  strategy,
  onActivate,
  onDelete,
  busy,
}: {
  strategy: LiveStrategy;
  onActivate?: () => void;
  onDelete?: () => void;
  busy: boolean;
}) => {
  const universeLabel =
    UNIVERSE_OPTIONS.find((o) => o.value === strategy.universe)?.label ?? strategy.universe;
  const clauseText =
    strategy.clauses.length > 0
      ? strategy.clauses.map((c) => `${getFactorLabel(c.factor)} ${c.op} ${c.value}`).join(', ')
      : '(없음)';
  const exitText = formatExit(strategy.exit_policy);
  const sizeKrw =
    strategy.position_size_krw > 0
      ? `₩${strategy.position_size_krw.toLocaleString()}`
      : '자본 균등 분배';

  return (
    <article
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        strategy.is_active
          ? 'border-primary/40 from-primary-fixed/30 to-surface-container-lowest bg-gradient-to-br'
          : 'border-outline-variant/30 bg-surface'
      }`}
    >
      {/* 헤더 — 이름 + 활성 뱃지 + 액션 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {strategy.is_active && (
            <span className="bg-primary text-on-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              활성
            </span>
          )}
          <span className="text-on-surface truncate text-[14px] font-semibold">
            {strategy.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onActivate && (
            <button
              type="button"
              onClick={onActivate}
              disabled={busy}
              className="border-outline-variant/60 bg-surface text-on-surface hover:bg-surface-container-low inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              활성화
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              aria-label="삭제"
              className="border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-error-container hover:text-error inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          )}
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="border-outline-variant/30 grid grid-cols-1 gap-x-5 gap-y-1 border-t pt-2 text-[11.5px] sm:grid-cols-2">
        <Row label="투자 대상" value={universeLabel} />
        <Row label="최대 보유" value={`${strategy.max_positions}종목`} />
        <Row label="진입 조건" value={clauseText} full />
        <Row label="청산" value={exitText} full />
        <Row label="종목당 배분" value={sizeKrw} />
        <Row label="마지막 수정" value={new Date(strategy.updated_at).toLocaleString('ko-KR')} />
      </div>
    </article>
  );
};

const Row = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <div className={`flex gap-2 ${full ? 'sm:col-span-2' : ''}`}>
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
