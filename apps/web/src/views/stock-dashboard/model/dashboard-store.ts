import { create } from 'zustand';

interface DashboardState {
  symbol: string;
  setSymbol: (symbol: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  symbol: 'NVDA',
  setSymbol: (symbol) => set({ symbol }),
}));
