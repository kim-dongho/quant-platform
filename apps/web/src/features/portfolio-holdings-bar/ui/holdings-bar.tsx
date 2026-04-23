'use client';

import type { PortfolioBacktestResult } from '@/entities/portfolio/model/types';

interface Props {
  result: PortfolioBacktestResult | null;
}

export const HoldingsBar = ({ result }: Props) => {
  if (!result || result.final_positions.length === 0) return null;

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[13px] font-semibold tracking-wider text-on-surface-variant uppercase">
            Last Rebalance Holdings
          </h3>
          <p className="text-[11px] text-on-surface-variant">
            백테스트 마지막 거래일의 보유 종목 · 동일 룰/유니버스로 라이브 운용 시 오늘 Today's Picks와 동일
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-on-surface-variant">
          {result.final_positions.length} positions
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.final_positions.map((s) => (
          <span
            key={s}
            className="rounded-full bg-secondary-container px-3 py-1 font-mono text-xs font-semibold text-on-secondary-container"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
};
