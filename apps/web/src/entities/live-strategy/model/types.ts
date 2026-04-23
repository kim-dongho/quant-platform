import type { Clause, ExitPolicy } from '@/entities/portfolio/model/types';

export interface LiveStrategy {
  id: number;
  name: string;
  universe: string;
  clauses: Clause[];
  max_positions: number;
  exit_policy: ExitPolicy | null;
  is_active: boolean;
  mode: 'paper';
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
}

export interface UpsertResponse extends LiveStrategy {
  replaced: { id: number; name: string } | null;
}

export interface StopResponse {
  stopped: boolean;
  id?: number;
  name?: string;
}
