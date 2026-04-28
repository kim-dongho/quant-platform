import { FACTOR_OPTIONS, OPS } from '@/entities/portfolio/model/factors';
import type { Clause, FactorKey, FactorOp } from '@/entities/portfolio/model/types';

import { RuleCardShell } from './rule-card-shell';

// 진입 팩터(매수 조건) 카드.
export const FactorCard = ({
  clause,
  onChange,
  onRemove,
}: {
  clause: Clause;
  onChange: (patch: Partial<Clause>) => void;
  onRemove: () => void;
}) => {
  const opt = FACTOR_OPTIONS.find((f) => f.key === clause.factor);
  return (
    <RuleCardShell
      icon="show_chart"
      title={opt?.label ?? clause.factor}
      subtitle={opt?.hint ?? '진입 조건'}
      onRemove={onRemove}
    >
      <div className="flex items-center gap-1.5">
        <select
          value={clause.factor}
          onChange={(e) => onChange({ factor: e.target.value as FactorKey })}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary min-w-0 flex-1 rounded-md border px-2 py-1 font-mono text-xs outline-none focus:ring-1"
        >
          {FACTOR_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={clause.op}
          onChange={(e) => onChange({ op: e.target.value as FactorOp })}
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
          value={clause.value}
          step={opt?.step ?? 0.1}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-20 shrink-0 rounded-md border px-1.5 py-1 text-right font-mono text-xs tabular-nums outline-none focus:ring-1"
        />
      </div>
    </RuleCardShell>
  );
};
