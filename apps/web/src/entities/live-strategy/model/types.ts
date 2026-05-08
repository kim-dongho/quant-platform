import type { Clause, ExitPolicy } from '@/entities/portfolio/model/types';

export type LiveMode = 'paper' | 'real';

export interface LiveStrategy {
  id: number;
  name: string;
  universe: string;
  clauses: Clause[];
  max_positions: number;
  exit_policy: ExitPolicy | null;
  is_active: boolean;
  mode: LiveMode;
  position_size_krw: number;
  last_rebalance_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveStrategyInput {
  name: string;
  universe: string;
  clauses: Clause[];
  max_positions: number;
  exit_policy: ExitPolicy | null;
  position_size_krw: number;
  mode?: LiveMode;
}

export interface UpsertResponse extends LiveStrategy {
  replaced: { id: number; name: string } | null;
}

export interface StopResponse {
  stopped: boolean;
  id?: number;
  name?: string;
  mode?: LiveMode;
}

export interface LiveClosedTrade {
  id: number;
  symbol: string;
  name: string | null;
  qty: number;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  exit_reason: string | null;
  pnl_krw: number;
  pnl_pct: number;
}

export interface LiveRealizedPnL {
  total_pnl_krw: number;
  total_pnl_pct: number;
  closed_count: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  trades: LiveClosedTrade[];
}
