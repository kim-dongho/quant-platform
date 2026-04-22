'use client';

import { useState } from 'react';

import type { DashboardMode } from '@/widgets/stock-dashboard/lib/use-dashboard-logic';
import { StockDashboardWidget } from '@/widgets/stock-dashboard/ui/stock-dashboard-widget';

import { SideNav } from '@/shared/ui/side-nav';

export const HomePage = () => {
  const [mode, setMode] = useState<DashboardMode>('backtest');

  return (
    <div className="flex min-h-screen bg-background text-on-background antialiased">
      <SideNav activeMode={mode} onModeChange={setMode} activeStrategy="RSI-Cross" />
      <main className="flex h-screen max-h-screen flex-1 flex-col overflow-hidden md:ml-60">
        <StockDashboardWidget mode={mode} />
      </main>
    </div>
  );
};
