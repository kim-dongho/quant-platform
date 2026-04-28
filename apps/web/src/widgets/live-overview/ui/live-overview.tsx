'use client';

import { ActiveStrategyCard } from '@/features/live-strategy-card/ui/active-strategy-card';
import { LiveCandidates } from '@/features/live-strategy-card/ui/live-candidates';
import { PaperAccountCard } from '@/features/paper-account/ui/paper-account-card';
import { OrderHistory } from '@/features/paper-orders/ui/order-history';

// 라이브 페이지 본문 — 활성 전략 카드 / 모의계좌 / 후보종목 / 주문내역.
export const LiveOverview = () => (
  <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
    <ActiveStrategyCard />
    <PaperAccountCard />
    <LiveCandidates />
    <OrderHistory />
  </div>
);
