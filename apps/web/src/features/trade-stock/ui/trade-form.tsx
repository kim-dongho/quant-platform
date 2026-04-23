'use client';

import { useEffect, useMemo, useState } from 'react';

import { usePaperQuoteQuery, usePlacePaperOrderMutation } from '@/entities/paper/api/paper-queries';
import type { OrderSide, OrderType } from '@/entities/paper/model/types';

import { formatPrice } from '@/shared/lib/format-price';

interface Props {
  symbol: string;
  /** (optional) 주문 성공 시 상위 화면 데이터 리프레시 훅 */
  onOrderPlaced?: () => void;
  /** (optional) 기존 대시보드 호환 — 미국 종목일 때 fallback 표시용 */
  currentPrice?: number;
}

const isKrxSymbol = (s: string) => /^\d{6}(\.(KS|KQ))?$/i.test(s.trim());

const pct = (v: number) => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export const TradeForm = ({ symbol, onOrderPlaced, currentPrice }: Props) => {
  const krx = isKrxSymbol(symbol);
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [limitPrice, setLimitPrice] = useState<number>(0);

  const { data: quote } = usePaperQuoteQuery(symbol, { enabled: krx });
  const placeOrder = usePlacePaperOrderMutation();

  // 지정가 input 기본값: 현재가로 한 번만 채워주고, 그 이후는 유저 편집 유지
  useEffect(() => {
    if (orderType === 'limit' && limitPrice === 0 && quote?.price) {
      setLimitPrice(Math.round(quote.price));
    }
  }, [orderType, limitPrice, quote?.price]);

  const priceForDisplay = quote?.price ?? currentPrice ?? 0;
  const changeRate = quote?.change_rate ?? 0;
  const changeColor =
    changeRate > 0 ? 'text-error' : changeRate < 0 ? 'text-primary' : 'text-on-surface-variant';

  const submit = async (side: OrderSide) => {
    if (!krx || qty <= 0) return;
    if (orderType === 'limit' && (!limitPrice || limitPrice <= 0)) return;
    try {
      await placeOrder.mutateAsync({
        symbol,
        qty,
        side,
        order_type: orderType,
        price: orderType === 'limit' ? limitPrice : undefined,
      });
      onOrderPlaced?.();
    } catch {
      /* error 는 mutation.error로 노출 */
    }
  };

  const submitting = placeOrder.isPending;
  const errorMessage = useMemo(() => {
    const err = placeOrder.error as unknown as {
      response?: { data?: { detail?: string } };
      message?: string;
    } | null;
    if (!err) return null;
    return err?.response?.data?.detail || err?.message || '주문 실패';
  }, [placeOrder.error]);

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex shrink-0 flex-col gap-2 border-t px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
      <div className="flex flex-wrap items-end gap-6">
        {/* 현재가 */}
        <div className="flex flex-col">
          <span className="text-on-surface-variant text-[10px] font-semibold tracking-wider uppercase">
            Current Price
          </span>
          <span className="text-on-surface font-mono text-[22px] leading-tight font-semibold tracking-tight tabular-nums">
            {krx ? formatPrice(priceForDisplay, symbol) : '--'}
          </span>
          {krx && quote && (
            <span className={`font-mono text-[11px] tabular-nums ${changeColor}`}>
              {pct(changeRate)} · {formatPrice(quote.change, symbol)}
            </span>
          )}
        </div>

        <div className="bg-outline-variant/30 hidden h-10 w-px sm:block" />

        {/* 수량 */}
        <div className="flex flex-col">
          <label className="text-on-surface-variant mb-1 text-[10px] font-semibold tracking-wider uppercase">
            수량
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '0', 10) || 0))}
            disabled={!krx || submitting}
            className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-24 rounded-md border px-2 py-1.5 text-right font-mono text-sm tabular-nums outline-none focus:ring-1 disabled:opacity-50"
          />
        </div>

        {/* 주문 유형 */}
        <div className="flex flex-col">
          <span className="text-on-surface-variant mb-1 text-[10px] font-semibold tracking-wider uppercase">
            유형
          </span>
          <div className="border-outline-variant/50 flex overflow-hidden rounded-md border">
            {(['market', 'limit'] as OrderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                disabled={!krx || submitting}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  orderType === t
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {t === 'market' ? '시장가' : '지정가'}
              </button>
            ))}
          </div>
        </div>

        {/* 지정가 입력 */}
        {orderType === 'limit' && (
          <div className="flex flex-col">
            <label className="text-on-surface-variant mb-1 text-[10px] font-semibold tracking-wider uppercase">
              가격
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={limitPrice || ''}
              onChange={(e) => setLimitPrice(parseInt(e.target.value || '0', 10) || 0)}
              disabled={!krx || submitting}
              className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-32 rounded-md border px-2 py-1.5 text-right font-mono text-sm tabular-nums outline-none focus:ring-1 disabled:opacity-50"
            />
          </div>
        )}

        {/* 매수/매도 버튼 */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit('buy')}
            disabled={!krx || submitting || qty <= 0}
            className="bg-error flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            매수
          </button>
          <button
            type="button"
            onClick={() => submit('sell')}
            disabled={!krx || submitting || qty <= 0}
            className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">trending_down</span>
            매도
          </button>
        </div>
      </div>

      {/* 상태 메시지 */}
      {!krx && (
        <div className="text-on-surface-variant text-[11px]">
          KIS Open API는 국내 종목(.KS/.KQ)만 지원합니다 — 검색창에서 국내 종목을 선택하세요.
        </div>
      )}
      {placeOrder.isSuccess && placeOrder.data && (
        <div className="text-success text-[11px]">
          ✓ 주문 접수됨 · 주문번호 {placeOrder.data.order_no}
        </div>
      )}
      {errorMessage && <div className="text-error text-[11px]">✗ {errorMessage}</div>}
    </div>
  );
};
