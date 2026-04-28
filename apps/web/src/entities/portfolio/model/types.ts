export type FactorKey =
  | 'rsi_14'
  | 'sma_20'
  | 'sma_50'
  | 'sma_200'
  | 'vol_ratio_20d'
  | 'return_5d'
  | 'price_vs_sma20'
  | 'price_vs_sma50'
  | 'price_vs_sma200'
  | 'sma20_vs_sma50';

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

// ─────────────────────────────────────────────────────────────
// 전략 자동 탐색 (grid search)
// ─────────────────────────────────────────────────────────────
export interface DiscoverRequest {
  universe: string;
  factors?: FactorKey[];
  ops?: FactorOp[];
  percentiles?: number[];
  start_date?: string;
  end_date?: string;
  train_ratio?: number;
  max_positions?: number;
  n_clauses: 1 | 2;
  top_n: number;
  exit_policy?: ExitPolicy | null;
}

export interface DiscoveredRow {
  clauses: Clause[];
  train_sharpe: number;
  train_cagr: number;
  train_mdd: number;
  train_trades: number;
  train_win_rate: number;
  train_alpha: number;
  train_beta: number;
  train_excess_cagr: number;
  test_sharpe: number;
  test_cagr: number;
  test_mdd: number;
  test_trades: number;
  test_win_rate: number;
  test_alpha: number;
  test_beta: number;
  test_excess_cagr: number;
}

export interface DiscoverResult {
  params: {
    universe: string;
    train_period: [string, string];
    test_period: [string, string];
    max_positions: number;
    n_clauses: number;
    factors_tried: string[];
    ops_tried: string[];
    percentiles_tried: number[];
  };
  evaluated: number;
  skipped: number;
  top: DiscoveredRow[];
  all: DiscoveredRow[];
}

// 비동기 discover — start 후 polling으로 status 조회
export interface DiscoverJobStarted {
  job_id: string;
}

export type DiscoverJobStatus = 'running' | 'done' | 'error';

export interface DiscoverJobState {
  status: DiscoverJobStatus;
  done: number;
  total: number;
  current: string;
  started_at?: number;
  ended_at?: number;
  result?: DiscoverResult;
  error?: string;
}
