'use client';

import { STRATEGY_PRESETS } from '@/features/chart-control/model/config';

import type { StrategyParams } from '../model/dashborad-store';

interface Props {
  params: StrategyParams;
  onSelect: (config: Partial<StrategyParams>) => void;
}

const PRESET_ICONS: Record<string, string> = {
  trend: 'show_chart',
  reversal: 'crop_din',
  hybrid: 'candlestick_chart',
};

const PRESET_DESCRIPTIONS: Record<string, string> = {
  trend: 'RSI + SMA Crossover with Vol filter',
  reversal: 'Support/Resistance breakout logic',
  hybrid: 'MACD divergence baseline',
};

const PRESET_LABELS: Record<string, string> = {
  trend: 'Trend Master',
  reversal: 'Box Trader',
  hybrid: 'Standard Hybrid',
};

const matches = (a: Partial<StrategyParams>, b: StrategyParams) => {
  return (
    (a.enable_sma ?? false) === b.enable_sma &&
    (a.enable_rsi ?? false) === b.enable_rsi &&
    (a.enable_macd ?? false) === b.enable_macd &&
    (a.enable_bb ?? false) === b.enable_bb
  );
};

export const StrategyList = ({ params, onSelect }: Props) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-on-surface text-[11px] font-semibold tracking-wider uppercase">
          Selected Logic
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {STRATEGY_PRESETS.map((preset) => {
          const isActive = matches(preset.config, params);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.config)}
              className={[
                'relative flex items-start gap-3 overflow-hidden rounded-lg p-2 text-left transition-colors',
                isActive
                  ? 'border-primary bg-surface-container-low border shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                  : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low border',
              ].join(' ')}
            >
              {isActive && <div className="bg-primary absolute top-0 bottom-0 left-0 w-1" />}
              <div
                className={[
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded',
                  isActive
                    ? 'bg-primary-fixed text-primary'
                    : 'bg-surface-container text-on-surface-variant',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {PRESET_ICONS[preset.id] ?? 'show_chart'}
                </span>
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-on-surface mb-1 text-sm leading-tight font-semibold">
                  {PRESET_LABELS[preset.id] ?? preset.name}
                </span>
                <span className="text-on-surface-variant text-xs leading-snug">
                  {PRESET_DESCRIPTIONS[preset.id] ?? preset.desc}
                </span>
              </div>
              {isActive && (
                <span className="material-symbols-outlined text-primary text-[18px]">
                  check_circle
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
