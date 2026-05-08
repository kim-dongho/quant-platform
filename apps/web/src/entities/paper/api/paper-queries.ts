import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getPaperBalance, getPaperOrders, getPaperQuote, placePaperOrder } from './paper-api';

type KisMode = 'paper' | 'real';

const isKrxSymbol = (s: string) => /^\d{6}(\.(KS|KQ))?$/i.test(s.trim());

/**
 * KIS 모의/실전 계좌 잔고. mode 별 (paper / real) 분리. KIS paper API는 초당 2건 제한이라 기본 15s.
 */
export const usePaperBalanceQuery = (options?: {
  enabled?: boolean;
  refetchMs?: number;
  mode?: KisMode;
}) => {
  const mode = options?.mode ?? 'paper';
  return useQuery({
    queryKey: ['paperBalance', mode],
    queryFn: () => getPaperBalance(mode),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchMs ?? 15000,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
};

/**
 * 국내주식 현재가. symbol이 6자리 숫자(선택적 .KS/.KQ suffix)일 때만 호출.
 */
export const usePaperQuoteQuery = (
  symbol: string,
  options?: { enabled?: boolean; refetchMs?: number; mode?: KisMode },
) => {
  const mode = options?.mode ?? 'paper';
  const enabled = (options?.enabled ?? true) && isKrxSymbol(symbol);
  return useQuery({
    queryKey: ['paperQuote', mode, symbol],
    queryFn: () => getPaperQuote(symbol, mode),
    enabled,
    refetchInterval: enabled ? (options?.refetchMs ?? 5000) : false,
    staleTime: 3000,
  });
};

/**
 * 당일 주문·체결 내역. mode 별.
 */
export const usePaperOrdersQuery = (options?: {
  enabled?: boolean;
  refetchMs?: number;
  mode?: KisMode;
}) => {
  const mode = options?.mode ?? 'paper';
  return useQuery({
    queryKey: ['paperOrders', mode],
    queryFn: () => getPaperOrders(mode),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchMs ?? 10000,
    staleTime: 5000,
  });
};

/**
 * 주문 제출 — placePaperOrder 가 mode 인자 받음. 성공 시 balance/orders 쿼리 invalidate.
 */
export const usePlacePaperOrderMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      req,
      mode = 'paper',
    }: {
      req: Parameters<typeof placePaperOrder>[0];
      mode?: KisMode;
    }) => placePaperOrder(req, mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paperBalance'] });
      qc.invalidateQueries({ queryKey: ['paperOrders'] });
    },
  });
};
