'use client';

import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { runFactorPortfolioBacktest } from '@/entities/factor-portfolio/api/factor-portfolio-api';
import type {
  FactorPortfolioRequest,
  FactorPortfolioResult,
} from '@/entities/factor-portfolio/model/types';

export interface FactorPortfolioConfig {
  universe: string;
  start_date: string;
  end_date: string;
  top_pct: number;
  rebalance_months: number;
}

const DEFAULT_CONFIG: FactorPortfolioConfig = {
  universe: 'kospi200',
  start_date: '2020-01-01',
  end_date: new Date().toISOString().slice(0, 10),
  top_pct: 0.2,
  rebalance_months: 3,
};

export const useFactorPortfolio = () => {
  const [config, setConfig] = useState<FactorPortfolioConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<FactorPortfolioResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (req: FactorPortfolioRequest) => runFactorPortfolioBacktest(req),
    onSuccess: (data) => setResult(data),
  });

  const run = () => {
    mutation.mutate({
      universe: config.universe,
      start_date: config.start_date,
      end_date: config.end_date,
      top_pct: config.top_pct,
      rebalance_months: config.rebalance_months,
    });
  };

  return {
    config,
    setConfig,
    result,
    isRunning: mutation.isPending,
    error: mutation.error as Error | null,
    run,
    reset: () => {
      setConfig(DEFAULT_CONFIG);
      setResult(null);
    },
  };
};
