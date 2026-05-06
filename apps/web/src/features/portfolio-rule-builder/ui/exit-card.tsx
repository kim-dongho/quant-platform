import { NumberInput } from '@/shared/ui/number-input';

import type { ExitCardMeta } from '../model/exit-meta';
import { RuleCardShell } from './rule-card-shell';

// 청산 조건(매도 조건) 카드 — meta 정의에 따라 입력 단위/범위 변동.
//
// sign='negative' 인 항목 (손절·추적 손절) 은 사용자에게 양수만 입력받고 내부적으로 음수로 저장.
//   - 화면: [  8 ] %  (왼쪽에 "−" 뱃지로 부호 표시)
//   - state: -8
// sign='positive' / 'positive_int' 는 입력값 그대로.
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
  const isNegativeSign = meta.sign === 'negative';
  // input 표시값: negative 이면 절댓값, 아니면 그대로
  const displayed = isNegativeSign ? Math.abs(value) : value;
  const handleChange = (n: number) => {
    onChange(isNegativeSign ? -Math.abs(n) : n);
  };

  return (
    <RuleCardShell icon={meta.icon} title={meta.label} subtitle={meta.hint} onRemove={onRemove}>
      <div className="flex items-center gap-2">
        {isNegativeSign && (
          <span className="text-on-surface-variant font-mono text-sm font-semibold">−</span>
        )}
        <NumberInput
          value={displayed}
          step={meta.step}
          min={isNegativeSign ? 0 : meta.min}
          max={isNegativeSign ? Math.abs(meta.min) : meta.max}
          onChange={handleChange}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-24 rounded-md border px-2 py-1 text-right font-mono text-sm tabular-nums outline-none focus:ring-1"
        />
        <span className="text-on-surface-variant text-xs">{meta.unit}</span>
      </div>
    </RuleCardShell>
  );
};
