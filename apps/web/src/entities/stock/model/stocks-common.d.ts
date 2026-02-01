export interface MarketData {
  time: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  sma_s?: number;
  sma_l?: number;
  rsi?: number;
  macd?: number;
  macd_s?: number; // Signal
  macd_h?: number; // Histogram
  bb_u?: number; // Upper
  bb_m?: number; // Middle
  bb_l?: number; // Lower
}

export interface ChartOptions {
  volume: boolean;
  rsi: boolean;
  macd: boolean;
  bollinger: boolean;
  sma: boolean;
}

export interface BacktestResultPoint {
  time: string;
  value: number; // Equity
}
