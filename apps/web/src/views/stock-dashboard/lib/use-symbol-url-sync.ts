'use client';

import { useEffect, useRef } from 'react';

import { parseAsString, useQueryStates } from 'nuqs';

import { useDashboardStore } from '../model/dashboard-store';

const parsers = { symbol: parseAsString };

// URL ?symbol=... 와 store.symbol 양방향 동기화. 마운트 시 1회 URL → store,
// 이후 store 변경 시 URL 업데이트.
export const useSymbolUrlSync = () => {
  const [urlParams, setUrlParams] = useQueryStates(parsers, { shallow: true, throttleMs: 300 });
  const symbol = useDashboardStore((s) => s.symbol);
  const setSymbol = useDashboardStore((s) => s.setSymbol);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    if (urlParams.symbol && urlParams.symbol !== symbol) {
      setSymbol(urlParams.symbol);
    }
    initialized.current = true;
  }, [urlParams.symbol, symbol, setSymbol]);

  useEffect(() => {
    if (!initialized.current) return;
    setUrlParams({ symbol });
  }, [symbol, setUrlParams]);
};
