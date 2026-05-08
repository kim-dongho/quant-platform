// 랭킹 기반 펀더멘털 factor 포트폴리오 백테스트.
//
// engine 의 factor_portfolio_backtest 응답 구조와 1:1 매칭.
// 기존 PortfolioBacktestResult 와 equity/benchmark 형식은 같지만 메트릭은 단순.

export interface FactorPortfolioRequest {
  universe: string;
  start_date: string;
  end_date?: string;
  top_pct?: number;
  rebalance_months?: number;
  min_stocks?: number;
  factor_dirs?: Record<string, number>;
}

export interface FactorPortfolioMetrics {
  cagr: number;
  mdd: number;
  sharpe: number;
  num_trades: number;
}

export interface FactorPortfolioTrade {
  date: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
}

export interface FactorPortfolioResult {
  universe: string;
  start_date: string;
  end_date: string;
  factor_dirs: Record<string, number>;
  top_pct: number;
  rebalance_months: number;
  metrics: FactorPortfolioMetrics;
  dates: string[];
  equity: { time: string; value: number }[];
  benchmark: { time: string; value: number }[];
  benchmark_symbol: string;
  benchmark_label: string;
  trades: FactorPortfolioTrade[];
  rebal_dates: string[];
  note?: string;
}
