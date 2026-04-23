'use client';

import { useState } from 'react';

import { BacktestChart } from '@/features/portfolio-backtest-chart/ui/backtest-chart';
import { BacktestMetrics } from '@/features/portfolio-backtest-chart/ui/backtest-metrics';
import { CandidatesTable } from '@/features/portfolio-candidates/ui/candidates-table';
import { HoldingsBar } from '@/features/portfolio-holdings-bar/ui/holdings-bar';
import { RuleBuilder } from '@/features/portfolio-rule-builder/ui/rule-builder';

import {
  useBacktestPortfolio,
  useScreenPortfolio,
} from '@/entities/portfolio/api/portfolio-queries';
import type { ExitPolicy, RuleConfig } from '@/entities/portfolio/model/types';

const DEFAULT_CONFIG: RuleConfig = {
  universe: 'sp500',
  clauses: [
    { factor: 'rsi_14', op: '<', value: 35 },
    { factor: 'price_vs_sma50', op: '>', value: 0 },
  ],
  max_positions: 10,
};

const DEFAULT_EXIT_POLICY: ExitPolicy = {
  stop_loss_pct: -5,
  take_profit_pct: 10,
  time_exit_days: 20,
};

export default function PortfolioPage() {
  const [config, setConfig] = useState<RuleConfig>(DEFAULT_CONFIG);
  const [exitPolicy, setExitPolicy] = useState<ExitPolicy | null>(DEFAULT_EXIT_POLICY);

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

  const isRunning = screenMutation.isPending || backtestMutation.isPending;
  const anyError = screenMutation.error || backtestMutation.error;

  return (
    <div className="bg-background flex h-full flex-1 flex-col overflow-hidden">
      <header className="border-outline-variant/30 bg-surface-container-lowest flex shrink-0 flex-wrap items-start justify-between gap-4 border-b px-6 py-4">
        <div>
          <h1 className="text-on-surface text-[22px] font-semibold tracking-tight">전략</h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            매매 조건을 만들어 과거 데이터로 이 규칙이 얼마나 벌었을지 시뮬레이션합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runSimulation}
            disabled={isRunning || config.clauses.length === 0}
            className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all disabled:opacity-50"
            title="오늘의 추천 종목과 과거 누적 수익률을 동시에 계산합니다"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            {isRunning ? '실행 중…' : '시뮬레이션 실행'}
          </button>
        </div>
      </header>

      {anyError && (
        <div className="border-error/30 bg-error-container/30 text-error shrink-0 border-b px-6 py-2 text-xs">
          {anyError.message}
        </div>
      )}

      {/* 본문: 좌(전략 규칙 고정) + 우(차트·지표·추천 세로 스크롤) */}
      <div className="flex flex-1 gap-4 overflow-hidden p-6">
        <aside className="flex w-[340px] shrink-0 flex-col">
          <RuleBuilder
            config={config}
            onChange={setConfig}
            exitPolicy={exitPolicy}
            onExitPolicyChange={setExitPolicy}
            onReset={resetAll}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <BacktestChart
            result={backtestMutation.data ?? null}
            isLoading={backtestMutation.isPending}
          />
          <BacktestMetrics
            result={backtestMutation.data ?? null}
            isLoading={backtestMutation.isPending}
          />
          <CandidatesTable
            result={screenMutation.data ?? null}
            isLoading={screenMutation.isPending}
          />
          <HoldingsBar result={backtestMutation.data ?? null} />
        </main>
      </div>
    </div>
  );
}
