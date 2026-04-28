import type { ExitCardMeta } from '../model/exit-meta';
import { RuleCardShell } from './rule-card-shell';

// 청산 조건(매도 조건) 카드 — meta 정의에 따라 입력 단위/범위 변동.
export const ExitCard = ({
  meta,
  value,
  onChange,
  onRemove,
}: {
  meta: ExitCardMeta;
  value: number;
  onChange: (v: number) => void;
  onRemove: () => void;
}) => {
  return (
    <RuleCardShell icon={meta.icon} title={meta.label} subtitle={meta.hint} onRemove={onRemove}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          step={meta.step}
          min={meta.min}
          max={meta.max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-24 rounded-md border px-2 py-1 text-right font-mono text-sm tabular-nums outline-none focus:ring-1"
        />
        <span className="text-on-surface-variant text-xs">{meta.unit}</span>
      </div>
    </RuleCardShell>
  );
};
