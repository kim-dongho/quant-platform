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
    <div className="border-outline-variant/30 bg-surface-container-lowest flex min-h-0 flex-1 flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-on-surface-variant text-[13px] font-semibold tracking-wider uppercase">
          Rules
        </h2>
        <p className="text-on-surface-variant text-[11px]">
          Screen과 Strategy Backtest가 공통으로 사용하는 종목 선정 조건 (AND 결합)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-on-surface-variant text-[11px] font-medium">Universe</span>
          <select
            value={config.universe}
            onChange={(e) => onChange({ ...config, universe: e.target.value })}
            className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-1"
          >
            {Array.from(new Set(UNIVERSE_OPTIONS.map((u) => u.group))).map((group) => (
              <optgroup key={group ?? 'default'} label={group ?? ''}>
                {UNIVERSE_OPTIONS.filter((u) => u.group === group).map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-on-surface-variant text-[11px] font-medium">Max Positions</span>
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
            className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-20 rounded-md border px-2 py-1.5 text-right text-sm outline-none focus:ring-1"
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant text-[11px] font-medium">Clauses (AND)</span>
          <div className="flex items-center gap-1">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                title="기본 룰로 초기화"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={addClause}
              className="border-outline-variant/50 bg-surface text-on-surface hover:bg-surface-container-low flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Add Rule
            </button>
          </div>
        </div>

        {config.clauses.length === 0 && (
          <p className="border-outline-variant/40 text-on-surface-variant rounded-md border border-dashed py-4 text-center text-xs">
            룰이 없습니다 — Add Rule로 조건 추가
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {config.clauses.map((c, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <select
                value={c.factor}
                onChange={(e) => updateClause(idx, { factor: e.target.value as FactorKey })}
                className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary min-w-0 flex-1 rounded-md border px-2 py-1 font-mono text-xs outline-none focus:ring-1"
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
                className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-12 shrink-0 rounded-md border px-1 py-1 text-center font-mono text-xs outline-none focus:ring-1"
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
                className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-16 shrink-0 rounded-md border px-1.5 py-1 text-right font-mono text-xs outline-none focus:ring-1"
              />
              <button
                type="button"
                onClick={() => removeClause(idx)}
                aria-label="Remove clause"
                className="text-on-surface-variant hover:bg-surface-container-low hover:text-error flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
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
