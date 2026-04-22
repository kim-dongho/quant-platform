'use client';

import { PlaceholderSection } from '@/shared/ui/placeholder-section';

export default function PortfolioPage() {
  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-background">
      <header className="border-b border-outline-variant/30 bg-surface-container-lowest px-6 py-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-on-surface">Portfolio</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          유니버스 스크리닝 룰을 정의하고, 후보 종목을 뽑아 포트폴리오 전략을 운용합니다
        </p>
      </header>

      <div className="grid flex-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
        <PlaceholderSection
          title="Rules"
          icon="rule"
          description="종목 선정 조건을 정의합니다 (RSI, 거래량, 시총, 섹터 등)"
        />
        <PlaceholderSection
          title="Candidates"
          icon="filter_list"
          description="현재 룰을 통과한 종목 리스트"
        />
        <PlaceholderSection
          title="Portfolio Backtest"
          icon="analytics"
          description="과거 데이터에 룰을 적용한 누적 수익률과 리밸런싱 결과"
        />
      </div>
    </div>
  );
}
