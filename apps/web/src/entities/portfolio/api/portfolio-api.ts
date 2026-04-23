import { apiClient } from '@/shared/api/client';

import type { ExitPolicy, PortfolioBacktestResult, RuleConfig, ScreenResult } from '../model/types';

export const screenPortfolio = async (config: RuleConfig): Promise<ScreenResult> => {
  const { data } = await apiClient.post<ScreenResult>('/portfolio/screen', config);
  return data;
};

export const backtestPortfolio = async (
  config: RuleConfig & {
    start_date?: string;
    end_date?: string;
    exit_policy?: ExitPolicy | null;
  },
): Promise<PortfolioBacktestResult> => {
  const { data } = await apiClient.post<PortfolioBacktestResult>('/portfolio/backtest', config);
  return data;
};
