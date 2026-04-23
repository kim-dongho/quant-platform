'use client';

import type { ScreenResult } from '@/entities/portfolio/model/types';

import { StockLogo } from '@/shared/ui/stock-logo';

interface Props {
  result: ScreenResult | null;
  isLoading: boolean;
}

export const CandidatesTable = ({ result, isLoading }: Props) => {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">Today's Picks</h2>
          <p className="text-[11px] leading-snug text-on-surface-variant">
            오늘 룰을 통과한 종목 (point-in-time)
          </p>
        </div>
        {result && (
          <span className="shrink-0 rounded-md bg-primary-fixed/60 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-on-primary-fixed uppercase">
            {result.candidates.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-4 text-xs text-on-surface-variant">
          Screening...
        </div>
      )}

      {!isLoading && !result && (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-outline-variant/40 py-8 text-center text-xs text-on-surface-variant">
          Run Simulation 후 표시
        </div>
      )}

      {!isLoading && result && result.candidates.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-outline-variant/40 p-4 text-center text-xs text-on-surface-variant">
          룰에 해당하는 종목 없음 — 조건 완화하거나 coverage({result.with_data}/{result.universe_size}) 확인
        </div>
      )}

      {!isLoading && result && result.candidates.length > 0 && (
        <>
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-1.5 text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
            <span>Symbol</span>
            <span>Price</span>
          </div>
          <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {result.candidates.map((c) => (
              <li
                key={c.symbol}
                className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5 hover:bg-surface-container-low"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StockLogo symbol={c.symbol} size={20} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-on-surface">{c.symbol}</span>
                    <span className="truncate text-[10px] text-on-surface-variant">
                      {c.company_name ?? '--'}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-on-surface">
                  {c.price != null ? c.price.toFixed(2) : '--'}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-outline-variant/30 pt-2 text-[10px] text-on-surface-variant">
            coverage {result.with_data}/{result.universe_size} · as of {result.as_of}
          </div>
        </>
      )}
    </div>
  );
};
