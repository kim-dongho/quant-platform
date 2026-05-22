import { create } from 'zustand';

import type { Timeframe } from '@/entities/stock/api/stocks-api';

// 차트에서 켜고 끌 수 있는 채널 / 추세선 옵션. 페이지 내내 유지되지만 새로고침 시 default.
export interface ChannelToggles {
  lrChannel: boolean;
  standardError: boolean;
  keltner: boolean;
  pitchfork: boolean;
  hhhl: boolean;
  horizontalLevels: boolean;
  donchian: boolean;
  pivotTrendline: boolean;
}

export const DEFAULT_CHANNELS: ChannelToggles = {
  lrChannel: true,
  standardError: false,
  keltner: false,
  pitchfork: false,
  hhhl: false,
  horizontalLevels: false,
  donchian: false,
  pivotTrendline: false,
};

interface DashboardState {
  symbol: string;
  setSymbol: (symbol: string) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  channels: ChannelToggles;
  toggleChannel: (key: keyof ChannelToggles) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  symbol: 'NVDA',
  setSymbol: (symbol) => set({ symbol }),
  timeframe: '1d',
  setTimeframe: (timeframe) => set({ timeframe }),
  channels: DEFAULT_CHANNELS,
  toggleChannel: (key) => set((s) => ({ channels: { ...s.channels, [key]: !s.channels[key] } })),
}));
