import { Suspense } from 'react';

import { StockDashboardPage } from '@/views/stock-dashboard/ui/stock-dashboard-page';

// useQueryStates(nuqs) 가 useSearchParams 에 의존하므로 Next 16 prerender 시
// Suspense 경계 필요. (CSR fallback)
export default function Page() {
  return (
    <Suspense fallback={null}>
      <StockDashboardPage />
    </Suspense>
  );
}
