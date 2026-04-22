'use client';

import type { StrategyParams } from '@/widgets/stock-dashboard/model/dashborad-store';

import { StrategyInput } from './strategy-input';

interface Props {
  params: StrategyParams;
  onParamChange: (key: keyof StrategyParams, value: number | boolean) => void;
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

const Toggle = ({ checked, onChange }: ToggleProps) => (
  <label className="relative inline-flex cursor-pointer items-center">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="peer sr-only"
    />
    <div
      className={[
        "peer h-4 w-8 rounded-full bg-outline-variant transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-['']",
        'peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white',
        'peer-focus:outline-none',
      ].join(' ')}
    />
  </label>
);

interface SectionProps {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}

const Section = ({ title, enabled, onToggle, children }: SectionProps) => (
  <div
    className={[
      'flex flex-col gap-2 transition-opacity duration-200',
      enabled ? 'opacity-100' : 'opacity-50',
    ].join(' ')}
  >
    <div className="mb-1 flex items-center justify-between">
      <span className="text-sm font-semibold text-on-surface">{title}</span>
      <Toggle checked={enabled} onChange={onToggle} />
    </div>
    {children}
  </div>
);

export const StrategyControls = ({ params, onParamChange }: Props) => {
  const updateParam = (key: keyof StrategyParams, val: number | boolean) => {
    onParamChange(key, val);
  };

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[11px] font-semibold tracking-wider text-on-surface uppercase">
        Parameters
      </span>

      <div className="flex flex-col gap-6 rounded-lg border border-outline-variant/30 bg-surface p-4">
        <Section
          title="SMA Trend"
          enabled={params.enable_sma}
          onToggle={(v) => updateParam('enable_sma', v)}
        >
          <div className="grid grid-cols-2 gap-2">
            <StrategyInput
              label="Fast Period"
              value={params.sma_short}
              disabled={!params.enable_sma}
              onChange={(val) => updateParam('sma_short', val)}
            />
            <StrategyInput
              label="Slow Period"
              value={params.sma_long}
              disabled={!params.enable_sma}
              onChange={(val) => updateParam('sma_long', val)}
            />
          </div>
        </Section>

        <Section
          title="RSI Filter"
          enabled={params.enable_rsi}
          onToggle={(v) => updateParam('enable_rsi', v)}
        >
          <div className="grid grid-cols-2 gap-2">
            <StrategyInput
              label="Oversold"
              value={params.rsi_buy_k}
              disabled={!params.enable_rsi}
              onChange={(val) => updateParam('rsi_buy_k', val)}
            />
            <StrategyInput
              label="Overbought"
              value={70}
              disabled={!params.enable_rsi}
              onChange={() => {}}
            />
          </div>
        </Section>

        <Section
          title="MACD Momentum"
          enabled={params.enable_macd}
          onToggle={(v) => updateParam('enable_macd', v)}
        >
          <div className="grid grid-cols-3 gap-2">
            <StrategyInput
              label="Fast"
              value={params.macd_fast}
              disabled={!params.enable_macd}
              onChange={(val) => updateParam('macd_fast', val)}
            />
            <StrategyInput
              label="Slow"
              value={params.macd_slow}
              disabled={!params.enable_macd}
              onChange={(val) => updateParam('macd_slow', val)}
            />
            <StrategyInput
              label="Signal"
              value={params.macd_sig}
              disabled={!params.enable_macd}
              onChange={(val) => updateParam('macd_sig', val)}
            />
          </div>
        </Section>

        <Section
          title="Bollinger Bands"
          enabled={params.enable_bb}
          onToggle={(v) => updateParam('enable_bb', v)}
        >
          <div className="grid grid-cols-2 gap-2">
            <StrategyInput
              label="Window"
              value={params.bb_window}
              disabled={!params.enable_bb}
              onChange={(val) => updateParam('bb_window', val)}
            />
            <StrategyInput
              label="Std Dev"
              value={params.bb_std}
              disabled={!params.enable_bb}
              onChange={(val) => updateParam('bb_std', val)}
            />
          </div>
        </Section>
      </div>
    </div>
  );
};
