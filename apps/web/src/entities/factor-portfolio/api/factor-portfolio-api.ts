import { apiClient } from '@/shared/api/client';

import type { FactorPortfolioRequest, FactorPortfolioResult } from '../model/types';

export const runFactorPortfolioBacktest = async (
  req: FactorPortfolioRequest,
): Promise<FactorPortfolioResult> => {
  // 6년치도 1초 안 걸리지만 보수적 timeout
  const { data } = await apiClient.post<FactorPortfolioResult>('/portfolio/factor-backtest', req, {
    timeout: 60 * 1000,
  });
  return data;
};
