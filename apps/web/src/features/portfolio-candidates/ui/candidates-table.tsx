'use client';

import type { ScreenResult } from '@/entities/portfolio/model/types';

import { formatPrice } from '@/shared/lib/format-price';
import { Spinner } from '@/shared/ui/spinner';
import { StockLogo } from '@/shared/ui/stock-logo';

interface Props {
  result: ScreenResult | null;
  isLoading: boolean;
}

export const CandidatesTable = ({ result, isLoading }: Props) => {
  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex h-full flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-on-surface text-[15px] font-semibold">Today's Picks</h2>
          <p className="text-on-surface-variant text-[11px] leading-snug">
            오늘 룰을 통과한 종목 (point-in-time)
          </p>
        </div>
        {result && (
          <span className="bg-primary-fixed/60 text-on-primary-fixed shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
            {result.candidates.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="text-on-surface-variant flex flex-1 flex-col items-center justify-center gap-3 py-8 text-xs">
          <Spinner size={28} />
          <span>Screening...</span>
        </div>
      )}

      {!isLoading && !result && (
        <div className="border-outline-variant/40 text-on-surface-variant flex flex-1 items-center justify-center rounded-md border border-dashed py-8 text-center text-xs">
          Run Simulation 후 표시
        </div>
      )}

      {!isLoading && result && result.candidates.length === 0 && (
        <div className="border-outline-variant/40 text-on-surface-variant flex flex-1 items-center justify-center rounded-md border border-dashed p-4 text-center text-xs">
          룰에 해당하는 종목 없음 — 조건 완화하거나 coverage({result.with_data}/
          {result.universe_size}) 확인
        </div>
      )}

      {!isLoading && result && result.candidates.length > 0 && (
        <>
          <div className="border-outline-variant/30 text-on-surface-variant flex items-center justify-between border-b pb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <span>Symbol</span>
            <span>Price</span>
          </div>
          <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {result.candidates.map((c) => (
              <li
                key={c.symbol}
                className="hover:bg-surface-container-low flex items-center justify-between gap-2 rounded-md px-1 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StockLogo symbol={c.symbol} size={20} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-on-surface truncate text-sm font-semibold">
                      {c.company_name ?? c.symbol}
                    </span>
                    <span className="text-on-surface-variant font-mono text-[10px]">
                      {c.symbol}
                    </span>
                  </div>
                </div>
                <span className="text-on-surface shrink-0 font-mono text-xs tabular-nums">
                  {formatPrice(c.price, c.symbol)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-outline-variant/30 text-on-surface-variant border-t pt-2 text-[10px]">
            coverage {result.with_data}/{result.universe_size} · as of {result.as_of}
          </div>
        </>
      )}
    </div>
  );
};
