'use client';

import { useState } from 'react';

import { ActiveStrategyCard } from '@/features/live-strategy-card/ui/active-strategy-card';
import { LiveCandidates } from '@/features/live-strategy-card/ui/live-candidates';
import { PositionSizeDialog } from '@/features/live-strategy-toggle/ui/position-size-dialog';
import { PaperAccountCard } from '@/features/paper-account/ui/paper-account-card';
import { OrderHistory } from '@/features/paper-orders/ui/order-history';

import {
  useActiveLiveStrategy,
  useAllActiveLiveStrategies,
} from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveMode } from '@/entities/live-strategy/model/types';

import { ModeTab } from './mode-tab';
import { StrategyLibraryDialog } from './strategy-library-dialog';

// 라이브 페이지 본문 — 활성 전략 / 모의계좌 / 후보종목 / 주문내역.
// paper / real 두 mode 별로 별도 활성 전략 가능 (한쪽만 활성화해도 됨).
export const LiveOverview = () => {
  const [mode, setMode] = useState<LiveMode>('paper');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const { data: activeStrategy } = useActiveLiveStrategy(mode);
  const { data: allActive } = useAllActiveLiveStrategies();

  const paperActive = !!allActive?.find((s) => s.mode === 'paper');
  const realActive = !!allActive?.find((s) => s.mode === 'real');

  return (
    <>
      <ModeTab value={mode} onChange={setMode} paperActive={paperActive} realActive={realActive} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <ActiveStrategyCard
          mode={mode}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenSize={() => setSizeOpen(true)}
        />
        <PaperAccountCard mode={mode} />
        <LiveCandidates />
        <OrderHistory mode={mode} />
      </div>

      <StrategyLibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} mode={mode} />
      {sizeOpen && activeStrategy && (
        <PositionSizeDialog
          strategy={activeStrategy}
          onClose={() => setSizeOpen(false)}
          mode={mode}
        />
      )}
    </>
  );
};
