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
  { key: 'sma_200', label: 'SMA(200)', hint: '200일 이동평균 (절대가)', step: 0.1 },
  { key: 'vol_ratio_20d', label: 'Vol(20d)', hint: '당일거래량 / 20일 평균', step: 0.1 },
  { key: 'return_5d', label: 'Ret(5d)', hint: '5일 수익률 (예: 0.05 = +5%)', step: 0.01 },
  {
    key: 'price_vs_sma20',
    label: 'P/SMA20',
    hint: '종가/SMA20 − 1 (단기추세 위/아래)',
    step: 0.01,
  },
  {
    key: 'price_vs_sma50',
    label: 'P/SMA50',
    hint: '종가/SMA50 − 1 (중기추세 위/아래)',
    step: 0.01,
  },
  {
    key: 'price_vs_sma200',
    label: 'P/SMA200',
    hint: '종가/SMA200 − 1 (장기추세 / bull·bear 필터)',
    step: 0.01,
  },
  {
    key: 'sma20_vs_sma50',
    label: 'SMA20/50',
    hint: 'SMA20/SMA50 − 1 (>0 골든크로스, <0 데드크로스)',
    step: 0.01,
  },
];

export const OPS: FactorOp[] = ['<', '<=', '>', '>=', '=', '!='];

export const UNIVERSE_OPTIONS: { value: string; label: string; group?: string }[] = [
  // 미국
  { value: 'nasdaq100', label: 'NASDAQ 100', group: '🇺🇸 US' },
  { value: 'sp500', label: 'S&P 500', group: '🇺🇸 US' },
  { value: 'russell1000', label: 'Russell 1000 (대형주)', group: '🇺🇸 US' },
  { value: 'russell2000', label: 'Russell 2000 (소형주)', group: '🇺🇸 US' },
  { value: 'russell3000', label: 'Russell 3000 (전 시장)', group: '🇺🇸 US' },
  { value: 'watchlist', label: '개인 Watchlist', group: '🇺🇸 US' },
  // 국내 (FinanceDataReader · 시총 기준 근사)
  { value: 'kospi200', label: 'KOSPI 200 (시총 상위)', group: '🇰🇷 KR' },
  { value: 'kosdaq150', label: 'KOSDAQ 150 (시총 상위)', group: '🇰🇷 KR' },
  { value: 'krx350', label: 'KRX 350 (KOSPI200 + KOSDAQ150)', group: '🇰🇷 KR' },
];

export const getFactorLabel = (key: FactorKey): string =>
  FACTOR_OPTIONS.find((f) => f.key === key)?.label ?? key;
