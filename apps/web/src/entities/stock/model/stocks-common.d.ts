export interface MarketData {
  time: string | number;
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
  // 장기 채널 — frontend 계산. 색상: LR=보라, Donchian=주황, Pivot=청록.
  lrChannel: boolean;
  donchian: boolean;
  pivotTrendline: boolean;
  // Standard Error Channel — 회귀선 ±SE 좁은 신뢰구간 (분홍).
  standardError: boolean;
  // Keltner Channel — EMA ± k×ATR (변동성 기반, 청록).
  keltner: boolean;
  // Andrews' Pitchfork — 3 swing point 기반 미디언선 + 평행 채널 (황갈).
  pitchfork: boolean;
  // HH/HL 자동 trendline — Dow 이론 추세 정의 (녹색/적색).
  hhhl: boolean;
  // Horizontal S/R levels — 직전 swing high/low 가로 점선 (회색).
  horizontalLevels: boolean;
}

export interface StockItem {
  symbol: string;
}
