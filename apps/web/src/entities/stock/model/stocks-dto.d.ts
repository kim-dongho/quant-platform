export interface getBacktestResultResponseDto {
  ticker: string;
  results: BacktestResultPoint[];
  final_return?: number;          // 최종 수익률
  total_trades?: number;          // 총 거래 횟수
  win_rate?: number;              // 승률
}

export interface getStockHistoryResponseDto {
  time: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}