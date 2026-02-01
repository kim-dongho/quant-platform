// @/widgets/stock-dashboard/model/dashboard-store.ts
import { create } from 'zustand';

import { ChartOptions } from '@/entities/stock/model/stocks-common';

interface DashboardState {
  symbol: string;
  companyName: string; // 서버에서 받은 이름 캐싱용
  strategyParams: {
    sma_short: number;
    sma_long: number;
    rsi_buy_k: number;
  };
  indicators: ChartOptions;

  // Actions
  setSymbol: (symbol: string) => void;
  setCompanyName: (name: string) => void;
  setStrategyParam: (key: string, value: number) => void;
  toggleIndicator: (key: keyof ChartOptions) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  symbol: 'NVDA',
  companyName: '',
  strategyParams: { sma_short: 10, sma_long: 50, rsi_buy_k: 60 },
  indicators: { volume: true, rsi: false, macd: false, sma: true, bollinger: false },

  setSymbol: (symbol) => set({ symbol }),
  setCompanyName: (companyName) => set({ companyName }),
  setStrategyParam: (key, value) =>
    set((state) => ({ strategyParams: { ...state.strategyParams, [key]: value } })),
  toggleIndicator: (key) =>
    set((state) => ({ indicators: { ...state.indicators, [key]: !state.indicators[key] } })),
}));
