'use client';

import { LiveStrategyToggle } from '@/features/live-strategy-toggle/ui/live-strategy-toggle';
import { BacktestChart } from '@/features/portfolio-backtest-chart/ui/backtest-chart';
import { BacktestMetrics } from '@/features/portfolio-backtest-chart/ui/backtest-metrics';
import { CandidatesTable } from '@/features/portfolio-candidates/ui/candidates-table';
import { HoldingsBar } from '@/features/portfolio-holdings-bar/ui/holdings-bar';
import { RuleBuilder } from '@/features/portfolio-rule-builder/ui/rule-builder';
import { DiscoverDialog } from '@/features/strategy-discover/ui/discover-dialog';

import { usePortfolioState } from '../model/use-portfolio-state';

export const PortfolioWorkbench = () => {
  const {
    config,
    setConfig,
    exitPolicy,
    setExitPolicy,
    discoverOpen,
    setDiscoverOpen,
    screenResult,
    backtestResult,
    isRunning,
    anyError,
    runSimulation,
    resetAll,
    applyDiscoveredClauses,
  } = usePortfolioState();

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
            onClick={() => setDiscoverOpen(true)}
            disabled={isRunning}
            className="border-outline-variant/50 bg-surface text-on-surface hover:bg-surface-container-low flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all disabled:opacity-50"
            title="여러 룰 조합을 자동으로 백테스트하고 우수한 룰을 추천받습니다"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            자동 탐색
          </button>
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
          <LiveStrategyToggle config={config} exitPolicy={exitPolicy} disabled={isRunning} />
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
          <BacktestChart result={backtestResult} isLoading={isRunning} />
          <BacktestMetrics result={backtestResult} isLoading={isRunning} />
          <CandidatesTable result={screenResult} isLoading={isRunning} />
          <HoldingsBar result={backtestResult} />
        </main>
      </div>

      <DiscoverDialog
        open={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        defaults={{ universe: config.universe, max_positions: config.max_positions }}
        exitPolicy={exitPolicy}
        onApply={applyDiscoveredClauses}
      />
    </div>
  );
};
