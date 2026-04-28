'use client';

import { useEffect, useRef, useState } from 'react';

import { useActiveLiveStrategy } from '@/entities/live-strategy/api/live-strategy-queries';
import {
  useBacktestPortfolio,
  useScreenPortfolio,
} from '@/entities/portfolio/api/portfolio-queries';
import type { Clause, ExitPolicy, RuleConfig } from '@/entities/portfolio/model/types';

import { DEFAULT_CONFIG, DEFAULT_EXIT_POLICY } from './defaults';

// 전략 페이지 본문 상태 + 시뮬레이션 mutation 훅 + 활성 전략 hydrate.
export const usePortfolioState = () => {
  const [config, setConfig] = useState<RuleConfig>(DEFAULT_CONFIG);
  const [exitPolicy, setExitPolicy] = useState<ExitPolicy | null>(DEFAULT_EXIT_POLICY);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  // 페이지 진입 시 활성 전략이 있으면 RuleBuilder에 자동 로드 (한 번만).
  // "수정" 흐름에서 들어왔을 때 이미 활성 룰이 채워져 있게.
  const { data: active } = useActiveLiveStrategy();
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!active || hydratedRef.current) return;
    setConfig({
      universe: active.universe,
      clauses: active.clauses,
      max_positions: active.max_positions,
    });
    setExitPolicy(active.exit_policy ?? null);
    hydratedRef.current = true;
  }, [active]);

  const screenMutation = useScreenPortfolio();
  const backtestMutation = useBacktestPortfolio();

  const runSimulation = () => {
    screenMutation.mutate(config);
    backtestMutation.mutate({ ...config, exit_policy: exitPolicy });
  };

  const resetAll = () => {
    setConfig(DEFAULT_CONFIG);
    setExitPolicy(DEFAULT_EXIT_POLICY);
  };

  const applyDiscoveredClauses = (clauses: Clause[]) => {
    setConfig((prev) => ({ ...prev, clauses }));
  };

  const isRunning = screenMutation.isPending || backtestMutation.isPending;
  const anyError = screenMutation.error || backtestMutation.error;

  return {
    config,
    setConfig,
    exitPolicy,
    setExitPolicy,
    discoverOpen,
    setDiscoverOpen,
    screenResult: screenMutation.data ?? null,
    backtestResult: backtestMutation.data ?? null,
    isRunning,
    anyError,
    runSimulation,
    resetAll,
    applyDiscoveredClauses,
  };
};
