import { parseAsArrayOf, parseAsBoolean, parseAsFloat, parseAsInteger, parseAsString } from 'nuqs';

export const dashboardParsers = {
  // 1. 기본 정보
  symbol: parseAsString,

  // 2. 활성화 플래그 (Boolean)
  enable_sma: parseAsBoolean,
  enable_rsi: parseAsBoolean,
  enable_macd: parseAsBoolean,
  enable_bb: parseAsBoolean,

  // 3. 숫자 파라미터 (Integer)
  sma_short: parseAsInteger,
  sma_long: parseAsInteger,
  rsi_buy_k: parseAsInteger,

  macd_fast: parseAsInteger,
  macd_slow: parseAsInteger,
  macd_sig: parseAsInteger,

  bb_window: parseAsInteger,
  bb_std: parseAsFloat,

  // 4. 지표 배열 (예: indicators=sma,rsi)
  indicators: parseAsArrayOf(parseAsString).withDefault([]),
};
