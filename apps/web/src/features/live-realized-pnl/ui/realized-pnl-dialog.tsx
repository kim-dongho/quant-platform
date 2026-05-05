'use client';

import { useEffect } from 'react';

import type { LiveRealizedPnL } from '@/entities/live-strategy/model/types';

import { formatPrice } from '@/shared/lib/format-price';
import { StockLogo } from '@/shared/ui/stock-logo';

interface Props {
  data: LiveRealizedPnL;
  onClose: () => void;
}

const fmtKRW = (v: number) => formatPrice(v, '000000.KS');
const fmtPct = (v: number) => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(2)}%`;
};
const fmtDate = (iso: string) => iso.slice(5).replace('-', '/');

export const RealizedPnLDialog = ({ data, onClose }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totalPositive = data.total_pnl_krw > 0;
  const totalNegative = data.total_pnl_krw < 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
      >
        <header className="border-outline-variant/30 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">history</span>
            <h2 className="text-on-surface text-[15px] font-semibold">청산 거래 내역</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-on-surface-variant hover:bg-surface-container-low h-7 w-7 rounded-md"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        <section className="bg-surface-container-low/40 border-outline-variant/30 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b px-5 py-3">
          <div>
            <span className="text-on-surface-variant text-[10px] tracking-wider uppercase">
              누적 손익
            </span>
            <span
              className={`ml-2 font-mono text-base font-semibold tabular-nums ${
                totalPositive ? 'text-success' : totalNegative ? 'text-error' : 'text-on-surface'
              }`}
            >
              {data.total_pnl_krw >= 0 ? '+' : ''}
              {fmtKRW(data.total_pnl_krw)}
            </span>
            <span
              className={`ml-1 font-mono text-[11px] tabular-nums ${
                totalPositive
                  ? 'text-success'
                  : totalNegative
                    ? 'text-error'
                    : 'text-on-surface-variant'
              }`}
            >
              ({fmtPct(data.total_pnl_pct)})
            </span>
          </div>
          <div className="text-on-surface-variant text-[11px]">
            <span>총 {data.closed_count}건</span>
            <span className="mx-1.5">·</span>
            <span className="text-success">승 {data.win_count}</span>
            <span className="mx-1">/</span>
            <span className="text-error">패 {data.loss_count}</span>
            <span className="mx-1.5">·</span>
            <span>승률 {(data.win_rate * 100).toFixed(0)}%</span>
          </div>
        </section>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {data.trades.length === 0 ? (
            <div className="text-on-surface-variant flex h-40 items-center justify-center text-xs">
              아직 청산 완료된 거래가 없어요
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-surface-container-low/60 text-on-surface-variant sticky top-0 text-[10px] tracking-wider uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">종목</th>
                  <th className="px-3 py-2 text-right font-semibold">수량</th>
                  <th className="px-3 py-2 text-right font-semibold">진입 → 청산</th>
                  <th className="px-3 py-2 text-right font-semibold">손익</th>
                  <th className="px-3 py-2 text-right font-semibold">사유</th>
                </tr>
              </thead>
              <tbody>
                {data.trades.map((t) => {
                  const positive = t.pnl_krw > 0;
                  const negative = t.pnl_krw < 0;
                  const isExternal = t.exit_reason === 'external_close';
                  return (
                    <tr
                      key={t.id}
                      className="border-outline-variant/20 hover:bg-surface-container-low/40 border-t"
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <StockLogo symbol={t.symbol} size={20} />
                          <div className="flex min-w-0 flex-col">
                            <span className="text-on-surface truncate font-semibold">
                              {t.name ?? t.symbol}
                            </span>
                            <span className="text-on-surface-variant font-mono text-[10px]">
                              {t.symbol}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-on-surface font-mono tabular-nums">
                          {t.qty.toLocaleString()}주
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="text-on-surface font-mono tabular-nums">
                          {fmtKRW(t.entry_price)} → {fmtKRW(t.exit_price)}
                        </div>
                        <div className="text-on-surface-variant font-mono text-[10px] tabular-nums">
                          {fmtDate(t.entry_date)} ~ {fmtDate(t.exit_date)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div
                          className={`font-mono font-semibold tabular-nums ${
                            isExternal
                              ? 'text-on-surface-variant'
                              : positive
                                ? 'text-success'
                                : negative
                                  ? 'text-error'
                                  : 'text-on-surface'
                          }`}
                        >
                          {isExternal ? '—' : `${t.pnl_krw >= 0 ? '+' : ''}${fmtKRW(t.pnl_krw)}`}
                        </div>
                        {!isExternal && (
                          <div
                            className={`font-mono text-[10px] tabular-nums ${
                              positive
                                ? 'text-success'
                                : negative
                                  ? 'text-error'
                                  : 'text-on-surface-variant'
                            }`}
                          >
                            {fmtPct(t.pnl_pct)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`text-[10px] font-medium tracking-wide ${
                            isExternal ? 'text-on-surface-variant' : 'text-on-surface'
                          }`}
                        >
                          {t.exit_reason ?? '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
