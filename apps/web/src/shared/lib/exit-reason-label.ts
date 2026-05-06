// 라이브 매매 청산 사유 (live_trades.exit_reason) 의 한국어 라벨 + 뱃지 스타일.
// engine 의 청산 룰 (apps/engine/src/service/live/executor.py) 과 1:1 대응.
type ExitReasonStyle = {
  label: string;
  // tailwind class — bg + text 짝. 뱃지에 그대로 spread.
  badge: string;
};

const EXIT_REASON_STYLE: Record<string, ExitReasonStyle> = {
  take_profit: {
    label: '익절',
    badge: 'bg-success-container text-on-success-container',
  },
  stop_loss: {
    label: '손절',
    badge: 'bg-error-container text-on-error-container',
  },
  time_exit: {
    label: '보유기간 만료',
    badge: 'bg-tertiary-container text-on-tertiary-container',
  },
  trailing_stop: {
    label: '트레일링 스탑',
    badge: 'bg-primary-container text-on-primary-container',
  },
  signal_exit: {
    label: '시그널 청산',
    badge: 'bg-secondary-container text-on-secondary-container',
  },
  external_close: {
    label: '외부 청산',
    badge: 'bg-surface-container-high text-on-surface-variant',
  },
};

const FALLBACK: ExitReasonStyle = {
  label: '—',
  badge: 'bg-surface-container-high text-on-surface-variant',
};

export const exitReasonStyle = (reason: string | null | undefined): ExitReasonStyle => {
  if (!reason) return FALLBACK;
  return EXIT_REASON_STYLE[reason] ?? { label: reason, badge: FALLBACK.badge };
};

export const exitReasonLabel = (reason: string | null | undefined): string =>
  exitReasonStyle(reason).label;
