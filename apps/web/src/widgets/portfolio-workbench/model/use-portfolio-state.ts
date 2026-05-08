'use client';

import { useEffect, useRef, useState } from 'react';

import { useActiveLiveStrategy } from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveMode } from '@/entities/live-strategy/model/types';
import {
  useBacktestPortfolio,
  useScreenPortfolio,
} from '@/entities/portfolio/api/portfolio-queries';
import type {
  Clause,
  ExitPolicy,
  PortfolioBacktestResult,
  RuleConfig,
  ScreenResult,
} from '@/entities/portfolio/model/types';

import { DEFAULT_CONFIG, DEFAULT_EXIT_POLICY } from './defaults';

interface ModeState {
  config: RuleConfig;
  exitPolicy: ExitPolicy | null;
  screenResult: ScreenResult | null;
  backtestResult: PortfolioBacktestResult | null;
}

const makeDefault = (): ModeState => ({
  config: DEFAULT_CONFIG,
  exitPolicy: DEFAULT_EXIT_POLICY,
  screenResult: null,
  backtestResult: null,
});

// 전략 페이지 본문 상태 — paper / real 두 mode 의 룰·결과를 독립적으로 관리.
// 탭 전환 시 편집기에 다른 mode 의 상태가 로드됨.
export const usePortfolioState = () => {
  const [mode, setMode] = useState<LiveMode>('paper');
  const [byMode, setByMode] = useState<Record<LiveMode, ModeState>>(() => ({
    paper: makeDefault(),
    real: makeDefault(),
  }));
  const [discoverOpen, setDiscoverOpen] = useState(false);

  const current = byMode[mode];

  // mode 별 활성 전략을 hydrate (각각 한 번만).
  // 페이지 진입 시 paper / real 활성 룰이 있으면 해당 슬롯에 자동 로드.
  const { data: activePaper } = useActiveLiveStrategy('paper');
  const { data: activeReal } = useActiveLiveStrategy('real');
  const hydrated = useRef<Record<LiveMode, boolean>>({ paper: false, real: false });

  useEffect(() => {
    if (!activePaper || hydrated.current.paper) return;
    setByMode((prev) => ({
      ...prev,
      paper: {
        ...prev.paper,
        config: {
          universe: activePaper.universe,
          clauses: activePaper.clauses,
          max_positions: activePaper.max_positions,
        },
        exitPolicy: activePaper.exit_policy ?? null,
      },
    }));
    hydrated.current.paper = true;
  }, [activePaper]);

  useEffect(() => {
    if (!activeReal || hydrated.current.real) return;
    setByMode((prev) => ({
      ...prev,
      real: {
        ...prev.real,
        config: {
          universe: activeReal.universe,
          clauses: activeReal.clauses,
          max_positions: activeReal.max_positions,
        },
        exitPolicy: activeReal.exit_policy ?? null,
      },
    }));
    hydrated.current.real = true;
  }, [activeReal]);

  const screenMutation = useScreenPortfolio();
  const backtestMutation = useBacktestPortfolio();

  // setter — 항상 현재 mode 의 슬롯만 수정.
  const setConfig = (next: RuleConfig | ((prev: RuleConfig) => RuleConfig)) => {
    setByMode((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        config: typeof next === 'function' ? next(prev[mode].config) : next,
      },
    }));
  };

  const setExitPolicy = (
    next: ExitPolicy | null | ((prev: ExitPolicy | null) => ExitPolicy | null),
  ) => {
    setByMode((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        exitPolicy: typeof next === 'function' ? next(prev[mode].exitPolicy) : next,
      },
    }));
  };

  const runSimulation = () => {
    // 현재 탭 mode 의 룰로 시뮬레이션, 결과는 그 mode 슬롯에 저장.
    // 비동기 응답 시점에 mode 가 바뀔 수 있어 closure 로 capture.
    const target = mode;
    const cfg = byMode[target].config;
    const exit = byMode[target].exitPolicy;

    screenMutation.mutate(cfg, {
      onSuccess: (data) =>
        setByMode((prev) => ({ ...prev, [target]: { ...prev[target], screenResult: data } })),
    });
    backtestMutation.mutate(
      { ...cfg, exit_policy: exit },
      {
        onSuccess: (data) =>
          setByMode((prev) => ({ ...prev, [target]: { ...prev[target], backtestResult: data } })),
      },
    );
  };

  const resetAll = () => {
    setByMode((prev) => ({ ...prev, [mode]: makeDefault() }));
  };

  const applyDiscoveredClauses = (clauses: Clause[]) => {
    setConfig((prev) => ({ ...prev, clauses }));
  };

  // 다른 mode 의 룰 / 청산 정책을 현재 mode 슬롯으로 복사. 결과는 비움 (재실행 필요).
  const copyFromOtherMode = () => {
    const other: LiveMode = mode === 'paper' ? 'real' : 'paper';
    setByMode((prev) => ({
      ...prev,
      [mode]: {
        config: { ...prev[other].config, clauses: [...prev[other].config.clauses] },
        exitPolicy: prev[other].exitPolicy,
        screenResult: null,
        backtestResult: null,
      },
    }));
  };

  const isRunning = screenMutation.isPending || backtestMutation.isPending;
  const anyError = screenMutation.error || backtestMutation.error;

  return {
    mode,
    setMode,
    paperActive: !!activePaper,
    realActive: !!activeReal,
    activePaperName: activePaper?.name ?? null,
    activeRealName: activeReal?.name ?? null,
    config: current.config,
    setConfig,
    exitPolicy: current.exitPolicy,
    setExitPolicy,
    discoverOpen,
    setDiscoverOpen,
    screenResult: current.screenResult,
    backtestResult: current.backtestResult,
    isRunning,
    anyError,
    runSimulation,
    resetAll,
    applyDiscoveredClauses,
    copyFromOtherMode,
  };
};
