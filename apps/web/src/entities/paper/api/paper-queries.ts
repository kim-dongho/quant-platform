import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getPaperBalance, getPaperOrders, getPaperQuote, placePaperOrder } from './paper-api';

const isKrxSymbol = (s: string) => /^\d{6}(\.(KS|KQ))?$/i.test(s.trim());

/**
 * KIS 모의/실전 계좌 잔고. KIS paper API는 초당 2건 제한이라 기본 15s.
 */
export const usePaperBalanceQuery = (options?: { enabled?: boolean; refetchMs?: number }) => {
  return useQuery({
    queryKey: ['paperBalance'],
    queryFn: getPaperBalance,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchMs ?? 15000,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
};

/**
 * 국내주식 현재가. symbol이 6자리 숫자(선택적 .KS/.KQ suffix)일 때만 호출.
 * 기본 5s 폴링 — TradeForm 가격 표시에 사용.
 */
export const usePaperQuoteQuery = (
  symbol: string,
  options?: { enabled?: boolean; refetchMs?: number },
) => {
  const enabled = (options?.enabled ?? true) && isKrxSymbol(symbol);
  return useQuery({
    queryKey: ['paperQuote', symbol],
    queryFn: () => getPaperQuote(symbol),
    enabled,
    refetchInterval: enabled ? (options?.refetchMs ?? 5000) : false,
    staleTime: 3000,
  });
};

/**
 * 당일 주문·체결 내역.
 */
export const usePaperOrdersQuery = (options?: { enabled?: boolean; refetchMs?: number }) => {
  return useQuery({
    queryKey: ['paperOrders'],
    queryFn: getPaperOrders,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchMs ?? 10000,
    staleTime: 5000,
  });
};

/**
 * 주문 제출. 성공 시 balance/orders 쿼리 invalidate 해서 화면이 즉시 갱신됨.
 */
export const usePlacePaperOrderMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: placePaperOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paperBalance'] });
      qc.invalidateQueries({ queryKey: ['paperOrders'] });
    },
  });
};
