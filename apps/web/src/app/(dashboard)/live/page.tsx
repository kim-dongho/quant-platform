'use client';

import { ActiveStrategyCard } from '@/features/live-strategy-card/ui/active-strategy-card';
import { LiveCandidates } from '@/features/live-strategy-card/ui/live-candidates';
import { PaperAccountCard } from '@/features/paper-account/ui/paper-account-card';
import { OrderHistory } from '@/features/paper-orders/ui/order-history';

export default function LivePage() {
  return (
    <div className="bg-background flex h-full flex-1 flex-col overflow-hidden">
      <header className="border-outline-variant/30 bg-surface-container-lowest flex items-center gap-3 border-b px-4 py-3">
        <span className="material-symbols-outlined text-primary text-[22px]">bolt</span>
        <span className="text-on-surface text-[18px] font-semibold">라이브</span>
        <span className="border-outline-variant/40 text-on-surface-variant rounded-md border px-2 py-0.5 text-xs">
          한국투자증권 모의 계좌
        </span>
        <span className="text-on-surface-variant ml-auto text-xs">
          전략 페이지에서 활성화한 룰이 이 계좌에서 자동으로 매매합니다
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <ActiveStrategyCard />
        <PaperAccountCard />
        <LiveCandidates />
        <OrderHistory />
      </div>
    </div>
  );
}
