import type { ReactNode } from 'react';

interface Props {
  /** 좌측 아이콘·로고 등 (선택). */
  leading?: ReactNode;
  /** 페이지 제목. 문자열 또는 inline 노드(symbol·chip 포함 가능). */
  title: ReactNode;
  /** 부제 — 한 줄 설명 텍스트 또는 chip. title 옆에 inline 으로 들어감. */
  subtitle?: ReactNode;
  /** 우측 버튼·검색 등 액션 영역. */
  actions?: ReactNode;
}

// 모든 대시보드 페이지(/backtest, /portfolio, /live)가 공유하는 헤더.
// 패딩·폰트 사이즈·라인을 고정해 페이지 간 시각 일관성을 확보.
// 모든 요소는 한 줄 inline 정렬 — leading · title · subtitle · ⋯ · actions.
export const PageHeader = ({ leading, title, subtitle, actions }: Props) => (
  <header className="border-outline-variant/30 bg-surface-container-lowest flex h-[60px] shrink-0 items-center gap-3 border-b px-6">
    {leading}
    <div className="text-on-surface flex items-center gap-2 text-[18px] leading-tight font-semibold tracking-tight">
      {title}
    </div>
    {subtitle && (
      <div className="text-on-surface-variant flex min-w-0 items-center gap-2 text-sm">
        {subtitle}
      </div>
    )}
    {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
);
