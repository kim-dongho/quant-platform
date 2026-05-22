'use client';

import { useEffect, useRef } from 'react';

import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

import type { Timeframe } from '@/entities/stock/api/stocks-api';

import { useDashboardStore } from '../model/dashboard-store';

const TIMEFRAMES: readonly Timeframe[] = ['1d', '1h', '4h'] as const;
const parsers = {
  symbol: parseAsString,
  tf: parseAsStringLiteral(TIMEFRAMES).withDefault('1d'),
};

// URL ?symbol=...&tf=1d|1h|4h 와 store 양방향 동기화.
export const useSymbolUrlSync = () => {
  const [urlParams, setUrlParams] = useQueryStates(parsers, { shallow: true, throttleMs: 300 });
  const symbol = useDashboardStore((s) => s.symbol);
  const setSymbol = useDashboardStore((s) => s.setSymbol);
  const timeframe = useDashboardStore((s) => s.timeframe);
  const setTimeframe = useDashboardStore((s) => s.setTimeframe);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    if (urlParams.symbol && urlParams.symbol !== symbol) {
      setSymbol(urlParams.symbol);
    }
    if (urlParams.tf && urlParams.tf !== timeframe) {
      setTimeframe(urlParams.tf);
    }
    initialized.current = true;
  }, [urlParams.symbol, urlParams.tf, symbol, timeframe, setSymbol, setTimeframe]);

  useEffect(() => {
    if (!initialized.current) return;
    setUrlParams({ symbol, tf: timeframe });
  }, [symbol, timeframe, setUrlParams]);
};
