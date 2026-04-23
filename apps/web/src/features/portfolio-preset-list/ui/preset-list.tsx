'use client';

import { PORTFOLIO_PRESETS, findActivePreset } from '@/entities/portfolio/model/presets';
import type { RuleConfig } from '@/entities/portfolio/model/types';

interface Props {
  config: RuleConfig;
  onSelect: (patch: Pick<RuleConfig, 'clauses' | 'max_positions'>) => void;
}

export const PresetList = ({ config, onSelect }: Props) => {
  const active = findActivePreset(config);

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-on-surface-variant text-[13px] font-semibold tracking-wider uppercase">
          프리셋
        </h2>
        <p className="text-on-surface-variant text-[11px]">
          자주 쓰이는 퀀트 전략 템플릿 — 클릭하면 아래 조건에 자동 채워집니다
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {PORTFOLIO_PRESETS.map((preset) => {
          const isActive = active?.id === preset.id;
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
                <span className="material-symbols-outlined text-[18px]">{preset.icon}</span>
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-on-surface mb-1 text-sm leading-tight font-semibold">
                  {preset.name}
                </span>
                <span className="text-on-surface-variant text-xs leading-snug">
                  {preset.description}
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
