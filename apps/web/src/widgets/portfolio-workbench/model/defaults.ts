import type { ExitPolicy, RuleConfig } from '@/entities/portfolio/model/types';

export const DEFAULT_CONFIG: RuleConfig = {
  universe: 'sp500',
  clauses: [
    { factor: 'rsi_14', op: '<', value: 35 },
    { factor: 'price_vs_sma50', op: '>', value: 0 },
  ],
  max_positions: 10,
};

export const DEFAULT_EXIT_POLICY: ExitPolicy = {
  stop_loss_pct: -5,
  take_profit_pct: 10,
  time_exit_days: 20,
};
