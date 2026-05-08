'use client';

import type { FactorPortfolioResult } from '@/entities/factor-portfolio/model/types';

interface Props {
  result: FactorPortfolioResult | null;
  isLoading: boolean;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

const METRIC_DEFS = [
  { key: 'cagr', label: '연평균 수익률', hint: '매년 평균 몇 % 벌었는지' },
  { key: 'mdd', label: '최대 낙폭', hint: '고점 대비 가장 크게 떨어진 폭' },
  { key: 'sharpe', label: '위험 대비 수익', hint: '1 이상 양호 · 2 이상 우수' },
  { key: 'num_trades', label: '거래 수', hint: '백테스트 기간 총 매매 횟수' },
];

const Card = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'positive' | 'negative' | 'neutral';
}) => {
  const color =
    tone === 'positive' ? 'text-secondary' : tone === 'negative' ? 'text-error' : 'text-on-surface';
  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-on-surface-variant text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span className={`font-mono text-[22px] leading-tight font-bold tabular-nums ${color}`}>
        {value}
      </span>
      <span className="text-on-surface-variant text-[10px] leading-snug">{hint}</span>
    </div>
  );
};

const EmptyGrid = ({ hint }: { hint: string }) => (
  <div className="grid grid-cols-4 gap-3">
    {METRIC_DEFS.map((m) => (
      <div
        key={m.key}
        className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-1 rounded-xl border p-3"
      >
        <span className="text-on-surface-variant text-[10px] font-semibold tracking-wider uppercase">
          {m.label}
        </span>
        <span className="text-on-surface-variant font-mono text-[22px] leading-tight font-bold tabular-nums">
          --
        </span>
        <span className="text-on-surface-variant text-[10px] leading-snug">{hint}</span>
      </div>
    ))}
  </div>
);

export const FactorMetrics = ({ result, isLoading }: Props) => {
  if (isLoading) return <EmptyGrid hint="계산 중…" />;
  if (!result) return <EmptyGrid hint="실행 후 표시됩니다" />;

  const m = result.metrics;
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card
        label="연평균 수익률"
        value={fmtPct(m.cagr)}
        hint="매년 평균 몇 % 벌었는지"
        tone={m.cagr > 0 ? 'positive' : m.cagr < 0 ? 'negative' : 'neutral'}
      />
      <Card
        label="최대 낙폭"
        value={fmtPct(m.mdd)}
        hint="고점 대비 가장 크게 떨어진 폭"
        tone="negative"
      />
      <Card
        label="위험 대비 수익"
        value={m.sharpe.toFixed(2)}
        hint="1 이상 양호 · 2 이상 우수"
        tone={m.sharpe > 1 ? 'positive' : m.sharpe < 0 ? 'negative' : 'neutral'}
      />
      <Card
        label="거래 수"
        value={m.num_trades.toLocaleString()}
        hint={`리밸런싱 ${result.rebal_dates.length}회 누적`}
        tone="neutral"
      />
    </div>
  );
};
