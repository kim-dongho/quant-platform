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
    <div className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-on-surface text-[15px] font-semibold">오늘의 추천 종목</h2>
          <p className="text-on-surface-variant text-[11px] leading-snug">
            현재 시점에서 조건을 통과한 종목들입니다
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
          <span>종목 추리는 중…</span>
        </div>
      )}

      {!isLoading && !result && (
        <div className="border-outline-variant/40 text-on-surface-variant flex flex-1 items-center justify-center rounded-md border border-dashed py-8 text-center text-xs">
          시뮬레이션 실행 후 표시됩니다
        </div>
      )}

      {!isLoading && result && result.candidates.length === 0 && (
        <div className="border-outline-variant/40 text-on-surface-variant flex flex-1 items-center justify-center rounded-md border border-dashed p-4 text-center text-xs">
          조건을 만족하는 종목이 없어요 — 조건을 조금 완화해보세요
          <br />
          (데이터 확보: {result.with_data}/{result.universe_size})
        </div>
      )}

      {!isLoading && result && result.candidates.length > 0 && (
        <>
          <div className="border-outline-variant/30 text-on-surface-variant flex items-center justify-between border-b pb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <span>종목</span>
            <span>현재가</span>
          </div>
          <ul className="flex max-h-[400px] flex-col gap-1 overflow-y-auto">
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
            데이터 확보 {result.with_data}/{result.universe_size} · 기준일 {result.as_of}
          </div>
        </>
      )}
    </div>
  );
};
