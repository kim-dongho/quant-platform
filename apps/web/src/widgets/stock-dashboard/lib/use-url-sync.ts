import { useEffect, useRef } from 'react';

import { useQueryStates } from 'nuqs';

import { ChartOptions } from '@/entities/stock/model/stocks-common';

import { useDashboardStore } from '../model/dashborad-store';
import { dashboardParsers } from './search-params';

export const useDashboardUrlSync = () => {
  const [urlParams, setUrlParams] = useQueryStates(dashboardParsers, {
    shallow: true,
    throttleMs: 300,
  });

  const { symbol, strategyParams, indicators, setSymbol, setStrategyParam, toggleIndicator } =
    useDashboardStore();

  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;

    // (1) Symbol 동기화
    if (urlParams.symbol && urlParams.symbol !== symbol) {
      setSymbol(urlParams.symbol);
    }

    // (2) Strategy Params 동기화
    Object.keys(dashboardParsers).forEach((key) => {
      // indicators와 symbol은 제외하고 전략 파라미터만 처리
      if (key === 'indicators' || key === 'symbol') return;

      const value = urlParams[key as keyof typeof urlParams];

      // 값이 존재하고(null 아님) 현재 스토어 값과 다르면 업데이트
      if (value !== null && value !== undefined) {
        // @ts-ignore: 키 타입 매칭이 복잡해서 일단 무시 (안전함)
        setStrategyParam(key, value);
      }
    });

    // (3) Indicators 동기화 (배열 -> 객체 매핑)
    // 예: urlParams.indicators = ['sma', 'rsi']
    if (urlParams.indicators.length > 0) {
      Object.keys(indicators).forEach((key) => {
        const k = key as keyof ChartOptions;
        const shouldBeActive = urlParams.indicators.includes(k);
        if (indicators[k] !== shouldBeActive) {
          toggleIndicator(k);
        }
      });
    }

    isInitialized.current = true;
  }, []); // 마운트 시 1회 실행

  useEffect(() => {
    if (!isInitialized.current) return;

    const activeIndicators = Object.entries(indicators)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => key);

    setUrlParams({
      symbol,
      ...strategyParams,
      indicators: activeIndicators.length > 0 ? activeIndicators : null,
    });
  }, [symbol, strategyParams, indicators, setUrlParams]);
};
