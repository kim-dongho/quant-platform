'use client';

import type { PortfolioBacktestResult } from '@/entities/portfolio/model/types';

interface Props {
  result: PortfolioBacktestResult | null;
  isLoading: boolean;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

const MetricCard = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'positive' | 'negative' | 'neutral';
}) => {
  const color =
    tone === 'positive' ? 'text-secondary' : tone === 'negative' ? 'text-error' : 'text-on-surface';
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
        {label}
      </span>
      <span className={`font-mono text-[28px] leading-tight font-bold tabular-nums ${color}`}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-on-surface-variant">{hint}</span>}
    </div>
  );
};

export const BacktestMetrics = ({ result, isLoading }: Props) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {['CAGR', 'Max Drawdown', 'Sharpe Ratio'].map((l) => (
          <div
            key={l}
            className="flex flex-col gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4"
          >
            <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
              {l}
            </span>
            <span className="font-mono text-[28px] leading-tight font-bold tabular-nums text-on-surface-variant">
              --
            </span>
            <span className="text-[11px] text-on-surface-variant">loading…</span>
          </div>
        ))}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {['CAGR', 'Max Drawdown', 'Sharpe Ratio'].map((l) => (
          <div
            key={l}
            className="flex flex-col gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4"
          >
            <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
              {l}
            </span>
            <span className="font-mono text-[28px] leading-tight font-bold tabular-nums text-on-surface-variant">
              --
            </span>
            <span className="text-[11px] text-on-surface-variant">Run Simulation 후 표시</span>
          </div>
        ))}
      </div>
    );
  }

  // 벤치마크 대비 초과 수익 계산
  const finalEquity = result.equity.at(-1)?.value ?? 1;
  const finalBench = result.benchmark.at(-1)?.value ?? 1;
  const excessPct = ((finalEquity - finalBench) * 100).toFixed(1);

  return (
    <div className="grid grid-cols-3 gap-3">
      <MetricCard
        label="CAGR"
        value={fmtPct(result.metrics.cagr)}
        hint={result.benchmark.length > 0 ? `${excessPct}% vs SPY` : undefined}
        tone={result.metrics.cagr >= 0 ? 'positive' : 'negative'}
      />
      <MetricCard
        label="Max Drawdown"
        value={fmtPct(result.metrics.mdd)}
        tone="negative"
      />
      <MetricCard
        label="Sharpe Ratio"
        value={result.metrics.sharpe.toFixed(2)}
        tone={result.metrics.sharpe >= 1 ? 'positive' : 'neutral'}
      />
    </div>
  );
};
