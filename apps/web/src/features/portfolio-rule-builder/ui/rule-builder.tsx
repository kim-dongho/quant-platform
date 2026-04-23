'use client';

import { FACTOR_OPTIONS, OPS, UNIVERSE_OPTIONS } from '@/entities/portfolio/model/factors';
import type { Clause, FactorKey, FactorOp, RuleConfig } from '@/entities/portfolio/model/types';

interface Props {
  config: RuleConfig;
  onChange: (config: RuleConfig) => void;
  onReset?: () => void;
}

export const RuleBuilder = ({ config, onChange, onReset }: Props) => {
  const updateClause = (idx: number, patch: Partial<Clause>) => {
    const next = config.clauses.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...config, clauses: next });
  };

  const addClause = () => {
    const used = new Set(config.clauses.map((c) => c.factor));
    const nextFactor = FACTOR_OPTIONS.find((f) => !used.has(f.key))?.key ?? 'rsi_14';
    onChange({
      ...config,
      clauses: [...config.clauses, { factor: nextFactor, op: '<', value: 30 }],
    });
  };

  const removeClause = (idx: number) => {
    onChange({ ...config, clauses: config.clauses.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[13px] font-semibold tracking-wider text-on-surface-variant uppercase">
          Rules
        </h2>
        <p className="text-[11px] text-on-surface-variant">
          Screen과 Strategy Backtest가 공통으로 사용하는 종목 선정 조건 (AND 결합)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-on-surface-variant">Universe</span>
          <select
            value={config.universe}
            onChange={(e) => onChange({ ...config, universe: e.target.value })}
            className="w-full rounded-md border border-outline-variant/50 bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {UNIVERSE_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-on-surface-variant">Max Positions</span>
          <input
            type="number"
            min={1}
            max={50}
            value={config.max_positions}
            onChange={(e) =>
              onChange({
                ...config,
                max_positions: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
              })
            }
            className="w-20 rounded-md border border-outline-variant/50 bg-surface px-2 py-1.5 text-right text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-on-surface-variant">Clauses (AND)</span>
          <div className="flex items-center gap-1">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                title="기본 룰로 초기화"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={addClause}
              className="flex items-center gap-1 rounded-md border border-outline-variant/50 bg-surface px-2 py-1 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Add Rule
            </button>
          </div>
        </div>

        {config.clauses.length === 0 && (
          <p className="rounded-md border border-dashed border-outline-variant/40 py-4 text-center text-xs text-on-surface-variant">
            룰이 없습니다 — Add Rule로 조건 추가
          </p>
        )}

        <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {config.clauses.map((c, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <select
                value={c.factor}
                onChange={(e) => updateClause(idx, { factor: e.target.value as FactorKey })}
                className="min-w-0 flex-1 rounded-md border border-outline-variant/50 bg-surface px-2 py-1 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {FACTOR_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={c.op}
                onChange={(e) => updateClause(idx, { op: e.target.value as FactorOp })}
                className="w-12 shrink-0 rounded-md border border-outline-variant/50 bg-surface px-1 py-1 text-center font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={c.value}
                step={FACTOR_OPTIONS.find((f) => f.key === c.factor)?.step ?? 0.1}
                onChange={(e) => updateClause(idx, { value: Number(e.target.value) })}
                className="w-16 shrink-0 rounded-md border border-outline-variant/50 bg-surface px-1.5 py-1 text-right font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => removeClause(idx)}
                aria-label="Remove clause"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-error"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
