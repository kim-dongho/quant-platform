'use client';

import { LiveStrategyToggle } from '@/features/live-strategy-toggle/ui/live-strategy-toggle';
import { BacktestChart } from '@/features/portfolio-backtest-chart/ui/backtest-chart';
import { BacktestMetrics } from '@/features/portfolio-backtest-chart/ui/backtest-metrics';
import { CandidatesTable } from '@/features/portfolio-candidates/ui/candidates-table';
import { HoldingsBar } from '@/features/portfolio-holdings-bar/ui/holdings-bar';
import { RuleBuilder } from '@/features/portfolio-rule-builder/ui/rule-builder';
import { DiscoverDialog } from '@/features/strategy-discover/ui/discover-dialog';

import { PageHeader } from '@/shared/ui/page-header';

import { usePortfolioState } from '../model/use-portfolio-state';
import { PortfolioModeTab } from './portfolio-mode-tab';

export const PortfolioWorkbench = () => {
  const {
    mode,
    setMode,
    paperActive,
    realActive,
    activePaperName,
    activeRealName,
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
    copyFromOtherMode,
  } = usePortfolioState();

  const otherHasStrategy = mode === 'paper' ? realActive : paperActive;
  const otherLabel = mode === 'paper' ? '실투자' : '모의투자';

  return (
    <div className="bg-background flex h-full flex-1 flex-col overflow-hidden">
      <PageHeader
        leading={<span className="material-symbols-outlined text-primary text-[24px]">rule</span>}
        title="전략"
        subtitle="모의·실투자 각각 다른 룰을 만들어 비교하거나 동시 운영합니다"
        actions={
          <>
            <button
              type="button"
              onClick={() => setDiscoverOpen(true)}
              disabled={isRunning}
              className="border-outline-variant/50 bg-surface text-on-surface hover:bg-surface-container-low inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all disabled:opacity-50"
              title="여러 룰 조합을 자동으로 백테스트하고 우수한 룰을 추천받습니다"
            >
              <span className="material-symbols-outlined text-[16px]">search</span>
              자동 탐색
            </button>
            <button
              type="button"
              onClick={runSimulation}
              disabled={isRunning || config.clauses.length === 0}
              className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all disabled:opacity-50"
              title="오늘의 추천 종목과 과거 누적 수익률을 동시에 계산합니다"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              {isRunning ? '실행 중…' : '시뮬레이션 실행'}
            </button>
            <LiveStrategyToggle
              config={config}
              exitPolicy={exitPolicy}
              disabled={isRunning}
              mode={mode}
            />
          </>
        }
      />

      <PortfolioModeTab
        value={mode}
        onChange={setMode}
        paperActive={paperActive}
        realActive={realActive}
        paperName={activePaperName}
        realName={activeRealName}
      />

      {anyError && (
        <div className="border-error/30 bg-error-container/30 text-error shrink-0 border-b px-6 py-2 text-xs">
          {anyError.message}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden p-6 pt-4">
        <aside className="flex w-[340px] shrink-0 flex-col gap-3">
          {otherHasStrategy && (
            <button
              type="button"
              onClick={copyFromOtherMode}
              className="border-outline-variant/50 bg-surface-container-low text-on-surface hover:bg-surface-container flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-[11.5px] font-medium transition-colors"
              title={`${otherLabel} 의 활성 룰을 현재 편집기로 복사`}
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              {otherLabel} 룰에서 복사
            </button>
          )}
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
