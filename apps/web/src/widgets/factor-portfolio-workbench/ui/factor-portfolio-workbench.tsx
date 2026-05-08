'use client';

import { PageHeader } from '@/shared/ui/page-header';

import { useFactorPortfolio } from '../model/use-factor-portfolio';
import { FactorChart } from './factor-chart';
import { FactorForm } from './factor-form';
import { FactorMetrics } from './factor-metrics';

export const FactorPortfolioWorkbench = () => {
  const { config, setConfig, result, isRunning, error, run, reset } = useFactorPortfolio();

  return (
    <div className="bg-background flex h-full flex-1 flex-col overflow-hidden">
      <PageHeader
        leading={
          <span className="material-symbols-outlined text-primary text-[24px]">leaderboard</span>
        }
        title="팩터 포트폴리오"
        subtitle="펀더멘털 6개 factor 종합 점수 top N% 매수 · 분기 리밸런싱 (랭킹 기반)"
        actions={
          <button
            type="button"
            onClick={run}
            disabled={isRunning}
            className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            {isRunning ? '실행 중…' : '백테스트 실행'}
          </button>
        }
      />

      {error && (
        <div className="border-error/30 bg-error-container/30 text-error shrink-0 border-b px-6 py-2 text-xs">
          {error.message}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden p-6">
        <aside className="flex w-[300px] shrink-0 flex-col">
          <FactorForm config={config} onChange={setConfig} onReset={reset} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <FactorChart result={result} isLoading={isRunning} />
          <FactorMetrics result={result} isLoading={isRunning} />
        </main>
      </div>
    </div>
  );
};
