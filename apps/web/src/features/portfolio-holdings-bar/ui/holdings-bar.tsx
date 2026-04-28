'use client';

import type { PortfolioBacktestResult } from '@/entities/portfolio/model/types';

interface Props {
  result: PortfolioBacktestResult | null;
}

export const HoldingsBar = ({ result }: Props) => {
  if (!result || result.final_positions.length === 0) return null;

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest rounded-xl border p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-on-surface-variant text-[13px] font-semibold tracking-wider uppercase">
            시뮬레이션 마지막 보유 종목
          </h3>
          <p className="text-on-surface-variant text-[11px]">
            과거 데이터의 마지막 거래일 기준 · 동일 조건으로 실제 운용하면 위의 &ldquo;오늘의 추천
            종목&rdquo;과 같아집니다
          </p>
        </div>
        <span className="text-on-surface-variant shrink-0 text-[11px]">
          {result.final_positions.length}종목
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.final_positions.map((p) => (
          <span
            key={p.symbol}
            title={p.symbol}
            className="bg-secondary-container text-on-secondary-container inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
          >
            <span className="font-semibold">{p.name || p.symbol}</span>
            <span className="font-mono text-[10px] opacity-70">{p.symbol}</span>
          </span>
        ))}
      </div>
    </div>
  );
};
