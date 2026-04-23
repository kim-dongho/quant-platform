export type FactorKey =
  | 'rsi_14'
  | 'sma_20'
  | 'sma_50'
  | 'vol_ratio_20d'
  | 'return_5d'
  | 'price_vs_sma50';

export type FactorOp = '<' | '<=' | '>' | '>=' | '=' | '!=';

export interface Clause {
  factor: FactorKey;
  op: FactorOp;
  value: number;
}

export interface RuleConfig {
  universe: string;
  clauses: Clause[];
  max_positions: number;
}

export interface Candidate {
  symbol: string;
  company_name: string | null;
  price: number | null;
  as_of: string | null;
  factors: Partial<Record<FactorKey, number | null>>;
}

export interface ScreenResult {
  as_of: string;
  universe_size: number;
  with_data: number;
  candidates: Candidate[];
}

export interface ExitPolicy {
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_pct?: number | null;
  time_exit_days?: number | null;
  signal_exit_clauses?: Clause[];
}

export type ExitReason =
  | 'stop_loss'
  | 'take_profit'
  | 'trailing_stop'
  | 'time_exit'
  | 'signal_exit';

export interface Trade {
  symbol: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  return_pct: number;
  hold_days: number;
  exit_reason: ExitReason;
}

export interface BacktestMetrics {
  cagr: number;
  mdd: number;
  sharpe: number;
  num_trades: number;
  win_rate: number;
  avg_hold_days: number;
  profit_factor: number;
}

export interface PortfolioBacktestResult {
  dates: string[];
  equity: { time: string; value: number }[];
  benchmark: { time: string; value: number }[];
  benchmark_symbol?: string;
  benchmark_label?: string;
  metrics: BacktestMetrics;
  final_positions: { symbol: string; name: string }[];
  trades: Trade[];
  start_date?: string;
  end_date?: string;
  note?: string;
}
