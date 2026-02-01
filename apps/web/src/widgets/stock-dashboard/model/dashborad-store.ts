import { create } from 'zustand';

import { ChartOptions } from '@/entities/stock/model/stocks-common';

export interface StrategyParams {
  // 1. 활성화 플래그 (On/Off)
  enable_sma: boolean;
  enable_rsi: boolean;
  enable_macd: boolean;
  enable_bb: boolean;

  // 2. SMA
  sma_short: number;
  sma_long: number;

  // 3. RSI
  rsi_buy_k: number;

  // 4. MACD
  macd_fast: number;
  macd_slow: number;
  macd_sig: number;

  // 5. 볼린저 밴드
  bb_window: number;
  bb_std: number;
}

interface DashboardState {
  symbol: string;
  companyName: string;
  strategyParams: StrategyParams;
  indicators: ChartOptions;

  // Actions
  setSymbol: (symbol: string) => void;
  setCompanyName: (name: string) => void;
  setStrategyParam: (key: keyof StrategyParams, value: number | boolean) => void;
  toggleIndicator: (key: keyof ChartOptions) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  symbol: 'NVDA',
  companyName: '',

  // 초기값 설정
  strategyParams: {
    // 기본적으로 SMA와 RSI만 켜둠
    enable_sma: true,
    enable_rsi: true,
    enable_macd: false,
    enable_bb: false,

    sma_short: 5,
    sma_long: 20,
    rsi_buy_k: 60,

    // MACD 표준 설정
    macd_fast: 12,
    macd_slow: 26,
    macd_sig: 9,

    // 볼린저 밴드 표준 설정
    bb_window: 20,
    bb_std: 2,
  },

  indicators: {
    volume: true,
    rsi: false,
    macd: false,
    sma: true,
    bollinger: false,
  },

  setSymbol: (symbol) => set({ symbol }),
  setCompanyName: (companyName) => set({ companyName }),

  setStrategyParam: (key, value) =>
    set((state) => ({
      strategyParams: { ...state.strategyParams, [key]: value },
    })),

  toggleIndicator: (key) =>
    set((state) => ({
      indicators: { ...state.indicators, [key]: !state.indicators[key] },
    })),
}));
