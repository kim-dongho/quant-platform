'use client';

import { useState } from 'react';

import { BacktestChart } from '@/features/portfolio-backtest-chart/ui/backtest-chart';
import { BacktestMetrics } from '@/features/portfolio-backtest-chart/ui/backtest-metrics';
import { CandidatesTable } from '@/features/portfolio-candidates/ui/candidates-table';
import { HoldingsBar } from '@/features/portfolio-holdings-bar/ui/holdings-bar';
import { PresetList } from '@/features/portfolio-preset-list/ui/preset-list';
import { RuleBuilder } from '@/features/portfolio-rule-builder/ui/rule-builder';

import {
  useBacktestPortfolio,
  useScreenPortfolio,
} from '@/entities/portfolio/api/portfolio-queries';
import type { RuleConfig } from '@/entities/portfolio/model/types';

const DEFAULT_CONFIG: RuleConfig = {
  universe: 'sp500',
  clauses: [
    { factor: 'rsi_14', op: '<', value: 35 },
    { factor: 'price_vs_sma50', op: '>', value: 0 },
  ],
  max_positions: 10,
};

export default function PortfolioPage() {
  const [config, setConfig] = useState<RuleConfig>(DEFAULT_CONFIG);

  const screenMutation = useScreenPortfolio();
  const backtestMutation = useBacktestPortfolio();

  const runSimulation = () => {
    screenMutation.mutate(config);
    backtestMutation.mutate(config);
  };
  const resetConfig = () => setConfig(DEFAULT_CONFIG);
  const applyPreset = (patch: Pick<RuleConfig, 'clauses' | 'max_positions'>) =>
    setConfig((prev) => ({ ...prev, ...patch }));

  const isRunning = screenMutation.isPending || backtestMutation.isPending;
  const anyError = screenMutation.error || backtestMutation.error;

  return (
    <div className="bg-background flex h-full flex-1 flex-col overflow-y-auto">
      <header className="border-outline-variant/30 bg-surface-container-lowest flex flex-wrap items-start justify-between gap-4 border-b px-6 py-4">
        <div>
          <h1 className="text-on-surface text-[22px] font-semibold tracking-tight">
            Strategy Backtester
          </h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            룰 기반 자동 스크리닝 + 리밸런싱 전략 · 오늘의 후보와 과거 시뮬레이션 성과를 한 화면에서
            확인
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runSimulation}
            disabled={isRunning || config.clauses.length === 0}
            className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all disabled:opacity-50"
            title="Screen(오늘 후보) + Strategy Backtest(과거 시뮬레이션) 동시 실행"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            {isRunning ? 'Running…' : 'Run Simulation'}
          </button>
        </div>
      </header>

      {anyError && (
        <div className="border-error/30 bg-error-container/30 text-error border-b px-6 py-2 text-xs">
          {anyError.message}
        </div>
      )}

      <div className="flex flex-col gap-4 p-6">
        {/* 메인 3컬럼: Rules | 메트릭+차트 | Today's Picks */}
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_280px] lg:items-stretch">
          {/* 좌: Presets + Rules — Rules는 남은 공간을 차지하며 내부 스크롤 */}
          <div className="flex min-h-0 flex-col gap-4">
            <PresetList config={config} onSelect={applyPreset} />
            <RuleBuilder config={config} onChange={setConfig} onReset={resetConfig} />
          </div>

          {/* 중: 메트릭 3카드 + 차트 — 차트가 남은 세로 공간 차지 */}
          <div className="flex min-h-0 flex-col gap-4">
            <BacktestMetrics
              result={backtestMutation.data ?? null}
              isLoading={backtestMutation.isPending}
            />
            <BacktestChart
              result={backtestMutation.data ?? null}
              isLoading={backtestMutation.isPending}
            />
          </div>

          {/* 우: Today's Picks */}
          <div className="min-h-0">
            <CandidatesTable
              result={screenMutation.data ?? null}
              isLoading={screenMutation.isPending}
            />
          </div>
        </div>

        {/* 하단 전폭: Last Rebalance Holdings */}
        <HoldingsBar result={backtestMutation.data ?? null} />
      </div>
    </div>
  );
}
