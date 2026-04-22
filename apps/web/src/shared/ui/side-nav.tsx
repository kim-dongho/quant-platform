'use client';

import Image from 'next/image';

import type { DashboardMode } from '@/widgets/stock-dashboard/lib/use-dashboard-logic';

interface NavItem {
  id: DashboardMode;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'backtest', label: 'Backtest', icon: 'history_edu' },
  { id: 'trade', label: 'Trade', icon: 'bolt' },
];

interface Props {
  activeMode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  activeStrategy?: string;
  userName?: string;
  userTier?: string;
}

export const SideNav = ({
  activeMode,
  onModeChange,
  activeStrategy = 'RSI-Cross',
  userName = 'Trader John',
  userTier = 'Pro Tier',
}: Props) => {
  return (
    <aside className="fixed top-0 left-0 z-50 hidden h-full w-60 flex-col border-r border-slate-200 bg-slate-50 pt-4 md:flex">
      <div className="mt-2 mb-8 flex items-center justify-center gap-4 px-4">
        <Image src="/assets/logo.png" alt="Quant Platform" width={36} height={36} priority />
        <h1 className="text-lg font-black tracking-tight text-blue-700 uppercase">
          Quant Platform
        </h1>
      </div>

      <nav className="flex flex-1 flex-col">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeMode;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              className={[
                'm-2 flex items-center gap-3 rounded-lg px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase transition-colors',
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 p-4">
        <div className="flex cursor-pointer items-center gap-3">
          <div className="bg-surface-variant text-primary flex h-8 w-8 items-center justify-center overflow-hidden rounded-full font-bold">
            {userName.slice(0, 1)}
          </div>
          <div className="flex flex-col">
            <span className="text-on-surface text-xs font-semibold">{userName}</span>
            <span className="text-on-surface-variant text-[10px]">{userTier}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
