'use client';

import type { PortfolioBacktestResult } from '@/entities/portfolio/model/types';

interface Props {
  result: PortfolioBacktestResult | null;
  isLoading: boolean;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmtPct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number, digits = 2) => v.toFixed(digits);

const METRIC_DEFS = [
  { key: 'cagr', label: '연평균 수익률', hint: '매년 평균 몇 % 벌었는지' },
  { key: 'mdd', label: '최대 낙폭', hint: '고점 대비 가장 크게 떨어진 폭' },
  { key: 'sharpe', label: '위험 대비 수익', hint: '1 이상 양호 · 2 이상 우수' },
  { key: 'win_rate', label: '승률', hint: '수익으로 끝난 거래 비율' },
  { key: 'avg_hold_days', label: '평균 보유일', hint: '한 종목을 평균 며칠 보유했는지' },
  {
    key: 'profit_factor',
    label: 'Profit Factor',
    hint: '총이익/총손실 — 1.5 이상 괜찮음, 2 이상 우수',
  },
];

type Tone = 'positive' | 'negative' | 'neutral';

const MetricCard = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: Tone;
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
      {hint && <span className="text-on-surface-variant text-[10px] leading-snug">{hint}</span>}
    </div>
  );
};

const EmptyGrid = ({ hint }: { hint: string }) => (
  <div className="grid grid-cols-3 gap-3">
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

export const BacktestMetrics = ({ result, isLoading }: Props) => {
  if (isLoading) return <EmptyGrid hint="계산 중…" />;
  if (!result) return <EmptyGrid hint="시뮬레이션 실행 후 표시됩니다" />;

  const m = result.metrics;

  // 벤치마크 대비 초과 수익
  const finalEquity = result.equity.at(-1)?.value ?? 1;
  const finalBench = result.benchmark.at(-1)?.value ?? 1;
  const excessPct = ((finalEquity - finalBench) * 100).toFixed(1);

  const cards: { label: string; value: string; hint: string; tone: Tone }[] = [
    {
      label: METRIC_DEFS[0].label,
      value: fmtPct(m.cagr),
      hint:
        result.benchmark.length > 0
          ? `${result.benchmark_label ?? '벤치마크'} 대비 ${excessPct}%`
          : METRIC_DEFS[0].hint,
      tone: m.cagr >= 0 ? 'positive' : 'negative',
    },
    {
      label: METRIC_DEFS[1].label,
      value: fmtPct(m.mdd),
      hint: METRIC_DEFS[1].hint,
      tone: 'negative',
    },
    {
      label: METRIC_DEFS[2].label,
      value: fmtNum(m.sharpe, 2),
      hint: METRIC_DEFS[2].hint,
      tone: m.sharpe >= 1 ? 'positive' : 'neutral',
    },
    {
      label: METRIC_DEFS[3].label,
      value: m.num_trades > 0 ? fmtPct1(m.win_rate) : '--',
      hint: m.num_trades > 0 ? `${m.num_trades}건 거래` : '거래 없음',
      tone: m.win_rate >= 0.5 ? 'positive' : m.win_rate > 0 ? 'neutral' : 'neutral',
    },
    {
      label: METRIC_DEFS[4].label,
      value: m.num_trades > 0 ? `${fmtNum(m.avg_hold_days, 1)}일` : '--',
      hint: METRIC_DEFS[4].hint,
      tone: 'neutral',
    },
    {
      label: METRIC_DEFS[5].label,
      value: m.num_trades > 0 ? fmtNum(m.profit_factor, 2) : '--',
      hint: METRIC_DEFS[5].hint,
      tone: m.profit_factor >= 1.5 ? 'positive' : m.profit_factor > 0 ? 'neutral' : 'neutral',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <MetricCard key={c.label} {...c} />
      ))}
    </div>
  );
};
