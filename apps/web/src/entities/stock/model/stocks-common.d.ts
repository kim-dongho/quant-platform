export interface MarketData {
  time: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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