'use client';

import type { LiveMode } from '@/entities/live-strategy/model/types';

interface Props {
  value: LiveMode;
  onChange: (m: LiveMode) => void;
  paperActive: boolean;
  realActive: boolean;
  paperName: string | null;
  realName: string | null;
}

const Tab = ({
  active,
  hasStrategy,
  strategyName,
  onClick,
  label,
  hint,
  danger,
}: {
  active: boolean;
  hasStrategy: boolean;
  strategyName: string | null;
  onClick: () => void;
  label: string;
  hint: string;
  danger?: boolean;
}) => {
  const baseColor = danger ? 'text-error' : 'text-primary';
  const baseBorder = danger ? 'border-error' : 'border-primary';
  const baseBg = danger ? 'bg-error-container/40' : 'bg-primary/10';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-1 items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left transition-all',
        active
          ? `${baseBorder} ${baseBg} ${baseColor}`
          : 'border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant hover:text-on-surface',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={[
            'inline-flex h-2 w-2 rounded-full',
            hasStrategy ? 'bg-secondary' : 'bg-outline-variant/60',
          ].join(' ')}
          title={hasStrategy ? '활성 전략 있음' : '활성 전략 없음'}
        />
        <div className="flex flex-col">
          <span className="text-[13px] leading-tight font-semibold">{label}</span>
          <span className="text-on-surface-variant text-[10.5px] leading-tight">{hint}</span>
        </div>
      </div>
      <div className="flex flex-col items-end text-[10.5px] leading-tight">
        <span className="text-on-surface-variant">활성</span>
        <span
          className={[
            'max-w-[140px] truncate font-medium',
            hasStrategy ? 'text-on-surface' : 'text-on-surface-variant/60',
          ].join(' ')}
        >
          {strategyName ?? '(없음)'}
        </span>
      </div>
    </button>
  );
};

export const PortfolioModeTab = ({
  value,
  onChange,
  paperActive,
  realActive,
  paperName,
  realName,
}: Props) => (
  <div className="flex gap-2 px-6 pt-4">
    <Tab
      active={value === 'paper'}
      hasStrategy={paperActive}
      strategyName={paperName}
      onClick={() => onChange('paper')}
      label="모의투자 룰"
      hint="가상 자금"
    />
    <Tab
      active={value === 'real'}
      hasStrategy={realActive}
      strategyName={realName}
      onClick={() => onChange('real')}
      label="실투자 룰"
      hint="실제 자금"
      danger
    />
  </div>
);
