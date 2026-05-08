'use client';

import type { LiveMode } from '@/entities/live-strategy/model/types';

interface Props {
  value: LiveMode;
  onChange: (m: LiveMode) => void;
  paperActive: boolean;
  realActive: boolean;
}

const TabButton = ({
  active,
  hasStrategy,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  hasStrategy: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all',
      active
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant hover:text-on-surface',
    ].join(' ')}
  >
    <span
      className={[
        'inline-flex h-2 w-2 rounded-full',
        hasStrategy ? 'bg-secondary' : 'bg-outline-variant/60',
      ].join(' ')}
    />
    <span>{label}</span>
    <span className="text-on-surface-variant text-[11px] font-normal">{hint}</span>
  </button>
);

export const ModeTab = ({ value, onChange, paperActive, realActive }: Props) => (
  <div className="flex gap-2 px-4 pt-4">
    <TabButton
      active={value === 'paper'}
      hasStrategy={paperActive}
      onClick={() => onChange('paper')}
      label="모의투자"
      hint="가상 자금"
    />
    <TabButton
      active={value === 'real'}
      hasStrategy={realActive}
      onClick={() => onChange('real')}
      label="실투자"
      hint="실제 자금"
    />
  </div>
);
