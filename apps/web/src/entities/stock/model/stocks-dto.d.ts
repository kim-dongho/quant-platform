export interface BacktestResponseDto {
  ticker: string;
  results: BacktestResultPoint[]; // 👈 이 부분이 빠져있었을 겁니다.
  final_return?: number;          // 최종 수익률 (선택사항)
  total_trades?: number;          // 총 거래 횟수 (선택사항)
  win_rate?: number;              // 승률 (선택사항)
}

export interface BacktestResultPoint {
  time: string;  // YYYY-MM-DD
  value: number; // Equity (수익률 지수)
}