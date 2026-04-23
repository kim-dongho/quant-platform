'use client';

import { usePaperOrdersQuery } from '@/entities/paper/api/paper-queries';
import type { OrderStatus, PaperOrder } from '@/entities/paper/model/types';

import { formatPrice } from '@/shared/lib/format-price';
import { Spinner } from '@/shared/ui/spinner';
import { StockLogo } from '@/shared/ui/stock-logo';

const STATUS_STYLE: Record<OrderStatus, { label: string; cls: string }> = {
  filled: { label: '체결', cls: 'bg-success/10 text-success' },
  partial: { label: '부분체결', cls: 'bg-primary-fixed/60 text-on-primary-fixed' },
  pending: { label: '미체결', cls: 'bg-surface-container-low text-on-surface-variant' },
};

const fmtKRW = (v: number) => formatPrice(v, '000000.KS');

const fmtTime = (t?: string) => {
  // KIS는 "HHMMSS" 형식 — 사람이 읽을 수 있게 HH:MM:SS로
  if (!t || t.length < 6) return t ?? '--';
  return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
};

export const OrderHistory = () => {
  const { data: orders = [], isLoading, error } = usePaperOrdersQuery();

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-3 rounded-xl border p-5">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-on-surface-variant text-[13px] font-semibold tracking-wider uppercase">
            오늘 주문 내역
          </h2>
          <p className="text-on-surface-variant text-[11px]">
            오늘 접수한 주문과 체결 상태 (10초마다 갱신)
          </p>
        </div>
        <span className="bg-primary-fixed/60 text-on-primary-fixed rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
          {orders.length}
        </span>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size={20} />
        </div>
      )}

      {error && (
        <div className="border-error/30 bg-error-container/30 text-error rounded-md border p-3 text-xs">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div className="border-outline-variant/40 text-on-surface-variant flex items-center justify-center rounded-md border border-dashed py-6 text-center text-xs">
          오늘 접수한 주문 없음
        </div>
      )}

      {orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-on-surface-variant text-[10px] font-semibold tracking-wider uppercase">
                <th className="border-outline-variant/30 border-b pr-3 pb-2 text-left">시간</th>
                <th className="border-outline-variant/30 border-b pr-3 pb-2 text-left">종목</th>
                <th className="border-outline-variant/30 border-b pr-3 pb-2 text-center">매매</th>
                <th className="border-outline-variant/30 border-b pr-3 pb-2 text-right">수량</th>
                <th className="border-outline-variant/30 border-b pr-3 pb-2 text-right">가격</th>
                <th className="border-outline-variant/30 border-b pb-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderRow key={o.order_no} order={o} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const OrderRow = ({ order }: { order: PaperOrder }) => {
  const status = STATUS_STYLE[order.status];
  const displayPrice = order.filled_avg_price > 0 ? order.filled_avg_price : order.price;
  return (
    <tr className="text-on-surface hover:bg-surface-container-low text-[13px]">
      <td className="border-outline-variant/20 text-on-surface-variant border-b py-2 pr-3 font-mono tabular-nums">
        {fmtTime(order.time)}
      </td>
      <td className="border-outline-variant/20 border-b py-2 pr-3">
        <div className="flex items-center gap-2">
          <StockLogo symbol={order.symbol} size={20} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{order.name || order.symbol}</span>
            <span className="text-on-surface-variant font-mono text-[10px]">{order.symbol}</span>
          </div>
        </div>
      </td>
      <td className="border-outline-variant/20 border-b py-2 pr-3 text-center">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            order.side === 'buy' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
          }`}
        >
          {order.side === 'buy' ? '매수' : '매도'}
        </span>
      </td>
      <td className="border-outline-variant/20 border-b py-2 pr-3 text-right font-mono tabular-nums">
        {order.filled_qty}/{order.qty}
      </td>
      <td className="border-outline-variant/20 border-b py-2 pr-3 text-right font-mono tabular-nums">
        {order.order_type === 'market' && order.filled_avg_price === 0
          ? '시장가'
          : fmtKRW(displayPrice)}
      </td>
      <td className="border-outline-variant/20 border-b py-2 text-center">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}>
          {status.label}
        </span>
      </td>
    </tr>
  );
};
