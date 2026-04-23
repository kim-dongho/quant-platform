import type { FactorKey, FactorOp } from './types';

export const FACTOR_OPTIONS: {
  key: FactorKey;
  label: string;
  hint?: string;
  step?: number;
}[] = [
  { key: 'rsi_14', label: 'RSI(14)', hint: '0~100, 과매도<30 / 과매수>70', step: 1 },
  { key: 'sma_20', label: 'SMA(20)', hint: '20일 이동평균 (절대가)', step: 0.1 },
  { key: 'sma_50', label: 'SMA(50)', hint: '50일 이동평균 (절대가)', step: 0.1 },
  { key: 'vol_ratio_20d', label: 'Vol(20d)', hint: '당일거래량 / 20일 평균', step: 0.1 },
  { key: 'return_5d', label: 'Ret(5d)', hint: '5일 수익률 (예: 0.05 = +5%)', step: 0.01 },
  { key: 'price_vs_sma50', label: 'P/SMA50', hint: '종가/SMA50 − 1 (예: 0.02 = +2%)', step: 0.01 },
];

export const OPS: FactorOp[] = ['<', '<=', '>', '>=', '=', '!='];

export const UNIVERSE_OPTIONS = [
  { value: 'nasdaq100', label: 'NASDAQ 100' },
  { value: 'sp500', label: 'S&P 500' },
  { value: 'russell1000', label: 'Russell 1000 (대형주)' },
  { value: 'russell2000', label: 'Russell 2000 (소형주)' },
  { value: 'russell3000', label: 'Russell 3000 (전 시장)' },
  { value: 'watchlist', label: '개인 Watchlist' },
  { value: 'all', label: 'All US Common (느림)' },
];

export const getFactorLabel = (key: FactorKey): string =>
  FACTOR_OPTIONS.find((f) => f.key === key)?.label ?? key;
