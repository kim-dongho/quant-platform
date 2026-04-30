'use client';

import { LiveOverview } from '@/widgets/live-overview/ui/live-overview';

import { PageHeader } from '@/shared/ui/page-header';

export const LivePage = () => (
  <div className="bg-background flex h-full flex-1 flex-col overflow-hidden">
    <PageHeader
      leading={<span className="material-symbols-outlined text-primary text-[24px]">bolt</span>}
      title="라이브"
      subtitle={
        <>
          <span className="border-outline-variant/40 inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
            한국투자증권 모의 계좌
          </span>
          <span>전략 페이지에서 활성화한 룰이 이 계좌에서 자동으로 매매합니다</span>
        </>
      }
    />

    <LiveOverview />
  </div>
);
