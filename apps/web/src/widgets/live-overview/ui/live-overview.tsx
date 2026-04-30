'use client';

import { useState } from 'react';

import { ActiveStrategyCard } from '@/features/live-strategy-card/ui/active-strategy-card';
import { LiveCandidates } from '@/features/live-strategy-card/ui/live-candidates';
import { PositionSizeDialog } from '@/features/live-strategy-toggle/ui/position-size-dialog';
import { PaperAccountCard } from '@/features/paper-account/ui/paper-account-card';
import { OrderHistory } from '@/features/paper-orders/ui/order-history';

import { useActiveLiveStrategy } from '@/entities/live-strategy/api/live-strategy-queries';

import { StrategyLibraryDialog } from './strategy-library-dialog';

// 라이브 페이지 본문 — 활성 전략 / 모의계좌 / 후보종목 / 주문내역.
// 두 개 모달(라이브러리, 종목당 배분 수정) 토글 상태도 여기서 관리.
export const LiveOverview = () => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const { data: activeStrategy } = useActiveLiveStrategy();

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <ActiveStrategyCard
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenSize={() => setSizeOpen(true)}
        />
        <PaperAccountCard />
        <LiveCandidates />
        <OrderHistory />
      </div>

      <StrategyLibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      {sizeOpen && activeStrategy && (
        <PositionSizeDialog strategy={activeStrategy} onClose={() => setSizeOpen(false)} />
      )}
    </>
  );
};
