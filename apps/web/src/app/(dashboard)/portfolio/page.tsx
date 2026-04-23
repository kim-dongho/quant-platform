'use client';

import { useState } from 'react';

import {
  useBacktestPortfolio,
  useIngestStatus,
  useIngestUniverse,
  useScreenPortfolio,
} from '@/entities/portfolio/api/portfolio-queries';
import type { RuleConfig } from '@/entities/portfolio/model/types';

import { BacktestChart } from '@/features/portfolio-backtest-chart/ui/backtest-chart';
import { BacktestMetrics } from '@/features/portfolio-backtest-chart/ui/backtest-metrics';
import { CandidatesTable } from '@/features/portfolio-candidates/ui/candidates-table';
import { HoldingsBar } from '@/features/portfolio-holdings-bar/ui/holdings-bar';
import { IngestProgressBanner } from '@/features/portfolio-ingest-progress/ui/ingest-progress-banner';
import { PresetList } from '@/features/portfolio-preset-list/ui/preset-list';
import { RuleBuilder } from '@/features/portfolio-rule-builder/ui/rule-builder';

import { useConfirm } from '@/shared/ui/dialog/dialog-provider';

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
  const [showBanner, setShowBanner] = useState(false);

  const screenMutation = useScreenPortfolio();
  const backtestMutation = useBacktestPortfolio();
  const ingestMutation = useIngestUniverse();
  const confirm = useConfirm();

  const { data: ingestStatus } = useIngestStatus(config.universe, showBanner);

  const runSimulation = async () => {
    if (config.universe === 'all') {
      const ok = await confirm({
        title: '전체 종목으로 실행하시겠어요?',
        icon: 'bar_chart',
        description: (
          <>
            DB에 저장된 <b>모든 종목</b>을 대상으로 Screen과 Strategy Backtest를 함께
            실행합니다. 처리 시간과 메모리 사용량이 큽니다.
          </>
        ),
        details: [
          { label: '예상 Screen', value: '3~10초' },
          { label: '예상 Backtest', value: '1~5분' },
        ],
        confirmText: 'Run Simulation',
        cancelText: 'Cancel',
      });
      if (!ok) return;
    }
    screenMutation.mutate(config);
    backtestMutation.mutate(config);
  };
  const runIngest = () => {
    ingestMutation.mutate(config.universe);
    setShowBanner(true);
  };
  const resetConfig = () => setConfig(DEFAULT_CONFIG);
  const applyPreset = (patch: Pick<RuleConfig, 'clauses' | 'max_positions'>) =>
    setConfig((prev) => ({ ...prev, ...patch }));

  const isRunning = screenMutation.isPending || backtestMutation.isPending;
  const anyError = screenMutation.error || backtestMutation.error || ingestMutation.error;

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-background">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/30 bg-surface-container-lowest px-6 py-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-on-surface">
            Strategy Backtester
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            룰 기반 자동 스크리닝 + 리밸런싱 전략 · 오늘의 후보와 과거 시뮬레이션 성과를 한 화면에서 확인
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runIngest}
            disabled={ingestMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface px-3 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
            title="유니버스 전체 시세/팩터를 백그라운드로 수집"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            {ingestMutation.isPending ? 'Starting…' : 'Prep Universe'}
          </button>
          <button
            type="button"
            onClick={runSimulation}
            disabled={isRunning || config.clauses.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all hover:bg-on-primary-fixed-variant disabled:opacity-50"
            title="Screen(오늘 후보) + Strategy Backtest(과거 시뮬레이션) 동시 실행"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            {isRunning ? 'Running…' : 'Run Simulation'}
          </button>
        </div>
      </header>

      <IngestProgressBanner
        status={ingestStatus}
        onDismiss={() => setShowBanner(false)}
      />

      {ingestMutation.data?.status === 'already_running' && !ingestStatus && (
        <div className="border-b border-outline-variant/30 bg-primary-fixed/30 px-6 py-2 text-xs text-on-primary-fixed">
          ⚠️ 이미 {ingestMutation.data.universe} 수집이 진행 중입니다
        </div>
      )}

      {anyError && (
        <div className="border-b border-error/30 bg-error-container/30 px-6 py-2 text-xs text-error">
          {anyError.message}
        </div>
      )}

      <div className="flex flex-col gap-4 p-6">
        {/* 메인 3컬럼: Rules | 메트릭+차트 | Today's Picks */}
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_280px]">
          {/* 좌: Presets + Rules */}
          <div className="flex flex-col gap-4">
            <PresetList config={config} onSelect={applyPreset} />
            <RuleBuilder config={config} onChange={setConfig} onReset={resetConfig} />
          </div>

          {/* 중: 메트릭 3카드 + 차트 */}
          <div className="flex flex-col gap-4">
            <BacktestMetrics result={backtestMutation.data ?? null} isLoading={backtestMutation.isPending} />
            <BacktestChart result={backtestMutation.data ?? null} isLoading={backtestMutation.isPending} />
          </div>

          {/* 우: Today's Picks */}
          <div>
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
