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

export interface PortfolioBacktestResult {
  dates: string[];
  equity: { time: string; value: number }[];
  benchmark: { time: string; value: number }[];
  metrics: {
    cagr: number;
    mdd: number;
    sharpe: number;
  };
  final_positions: string[];
  start_date?: string;
  end_date?: string;
  note?: string;
}
