'use client';

import { useState } from 'react';

import { RealizedPnLDialog } from '@/features/live-realized-pnl/ui/realized-pnl-dialog';

import { useLiveRealizedPnL } from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveRealizedPnL } from '@/entities/live-strategy/model/types';
import { usePaperBalanceQuery } from '@/entities/paper/api/paper-queries';
import type { PaperHolding } from '@/entities/paper/model/types';

import { formatPrice } from '@/shared/lib/format-price';
import { Spinner } from '@/shared/ui/spinner';
import { StockLogo } from '@/shared/ui/stock-logo';

// 국내 계좌이므로 KRW 포맷 고정 — 'symbol에 .KS 있는 것과 무관하게' 계좌 통화는 원화
const fmtKRW = (v: number) => formatPrice(v, '000000.KS');
const fmtPct = (v: number) => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export const PaperAccountCard = () => {
  const { data, isLoading, error } = usePaperBalanceQuery();
  const { data: pnl } = useLiveRealizedPnL();
  const [pnlOpen, setPnlOpen] = useState(false);

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex h-full flex-col gap-4 rounded-xl border p-5">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-on-surface-variant text-[13px] font-semibold tracking-wider uppercase">
            내 계좌
          </h2>
        </div>
        {data && (
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
              data.mode === 'paper'
                ? 'bg-primary-fixed/60 text-on-primary-fixed'
                : 'bg-error-container text-error'
            }`}
          >
            {data.mode}
          </span>
        )}
      </header>

      {isLoading && (
        <div className="text-on-surface-variant flex flex-1 flex-col items-center justify-center gap-3 text-xs">
          <Spinner size={24} />
          <span>계좌 정보 불러오는 중…</span>
        </div>
      )}

      {error && (
        <div className="border-error/30 bg-error-container/30 text-error rounded-md border p-3 text-xs">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <SummaryBlock summary={data.summary} holdings={data.holdings} />
          {pnl && <RealizedPnLRow pnl={pnl} onOpen={() => setPnlOpen(true)} />}
          <HoldingsList holdings={data.holdings} />
        </>
      )}

      {pnlOpen && pnl && <RealizedPnLDialog data={pnl} onClose={() => setPnlOpen(false)} />}
    </div>
  );
};

const RealizedPnLRow = ({ pnl, onOpen }: { pnl: LiveRealizedPnL; onOpen: () => void }) => {
  const hasTrades = pnl.closed_count > 0;
  const positive = pnl.total_pnl_krw > 0;
  const negative = pnl.total_pnl_krw < 0;

  return (
    <button
      type="button"
      onClick={() => hasTrades && onOpen()}
      disabled={!hasTrades}
      className={`bg-surface-container-low/60 border-outline-variant/30 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
        hasTrades ? 'hover:bg-surface-container-low cursor-pointer' : 'cursor-default opacity-70'
      }`}
    >
      <div className="flex flex-col">
        <span className="text-on-surface-variant text-[10px] font-semibold tracking-wider uppercase">
          누적 실현손익
        </span>
        {hasTrades ? (
          <span className="text-on-surface-variant text-[10px]">
            청산 {pnl.closed_count}건 · 승률 {(pnl.win_rate * 100).toFixed(0)}%
          </span>
        ) : (
          <span className="text-on-surface-variant text-[10px]">
            아직 청산 완료된 거래가 없어요
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasTrades && (
          <div className="flex flex-col items-end">
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                positive ? 'text-success' : negative ? 'text-error' : 'text-on-surface'
              }`}
            >
              {pnl.total_pnl_krw >= 0 ? '+' : ''}
              {fmtKRW(pnl.total_pnl_krw)}
            </span>
            <span
              className={`font-mono text-[10px] tabular-nums ${
                positive ? 'text-success' : negative ? 'text-error' : 'text-on-surface-variant'
              }`}
            >
              {fmtPct(pnl.total_pnl_pct * 100)}
            </span>
          </div>
        )}
        {hasTrades && (
          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
            chevron_right
          </span>
        )}
      </div>
    </button>
  );
};

const SummaryBlock = ({
  summary,
  holdings,
}: {
  summary: { total_eval: number; cash: number; deposit_d2: number; total_profit: number };
  holdings: PaperHolding[];
}) => {
  const profitPositive = summary.total_profit > 0;
  const profitNegative = summary.total_profit < 0;

  // 총 수익률 = 평가손익 / 매수 원금 (= sum(qty × 평단)).
  // 보유 종목이 없거나 원금이 0이면 0% 표시.
  const investedAmount = holdings.reduce((sum, h) => sum + h.qty * h.avg_cost, 0);
  const returnPct = investedAmount > 0 ? (summary.total_profit / investedAmount) * 100 : 0;

  return (
    <section className="bg-surface-container-low flex flex-col gap-3 rounded-md p-3">
      <div>
        <div className="text-on-surface-variant text-[10px] font-semibold tracking-wider uppercase">
          총 평가금액
        </div>
        <div className="text-on-surface font-mono text-[22px] font-semibold tabular-nums">
          {fmtKRW(summary.total_eval)}
        </div>
        <div
          className={`flex items-baseline gap-1.5 font-mono text-[11px] tabular-nums ${
            profitPositive
              ? 'text-success'
              : profitNegative
                ? 'text-error'
                : 'text-on-surface-variant'
          }`}
        >
          <span>평가손익 {fmtKRW(summary.total_profit)}</span>
          {investedAmount > 0 && <span className="font-semibold">({fmtPct(returnPct)})</span>}
        </div>
      </div>
      <div className="border-outline-variant/30 grid grid-cols-2 gap-2 border-t pt-2">
        <MiniStat
          label="매수가능"
          value={fmtKRW(summary.deposit_d2)}
          hint="D+2 정산 후 실제 매수에 쓸 수 있는 예수금"
        />
        <MiniStat
          label="예수금 총액"
          value={fmtKRW(summary.cash)}
          hint="정산 전 매수·매도 포함 총액 (KIS dnca_tot_amt)"
        />
      </div>
    </section>
  );
};

const MiniStat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="flex flex-col" title={hint}>
    <span className="text-on-surface-variant text-[10px] tracking-wider uppercase">{label}</span>
    <span className="text-on-surface font-mono text-[13px] tabular-nums">{value}</span>
  </div>
);

const HoldingsList = ({ holdings }: { holdings: PaperHolding[] }) => {
  if (holdings.length === 0) {
    return (
      <section className="flex min-h-[120px] flex-col gap-1.5">
        <div className="text-on-surface-variant text-[10px] font-semibold tracking-wider uppercase">
          보유 종목
        </div>
        <div className="border-outline-variant/40 text-on-surface-variant flex flex-1 items-center justify-center rounded-md border border-dashed py-6 text-center text-xs">
          아직 보유한 종목이 없어요
        </div>
      </section>
    );
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="text-on-surface-variant flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase">
        <span>보유 종목 ({holdings.length})</span>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {holdings.map((h) => {
          const positive = h.profit_rate > 0;
          const negative = h.profit_rate < 0;
          return (
            <li
              key={h.symbol}
              className="hover:bg-surface-container-low flex items-center gap-2 rounded-md px-1 py-1.5"
            >
              <StockLogo symbol={h.symbol} size={24} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-on-surface truncate text-sm font-semibold">{h.name}</span>
                <span className="text-on-surface-variant font-mono text-[10px]">
                  {h.qty.toLocaleString()}주 · 평단 {fmtKRW(h.avg_cost)}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="text-on-surface font-mono text-xs tabular-nums">
                  {fmtKRW(h.eval_amount)}
                </span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    positive ? 'text-success' : negative ? 'text-error' : 'text-on-surface-variant'
                  }`}
                >
                  {fmtPct(h.profit_rate)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
