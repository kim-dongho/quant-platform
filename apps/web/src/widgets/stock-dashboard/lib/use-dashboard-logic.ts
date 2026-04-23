// apps/web/src/widgets/stock-dashboard/lib/use-dashboard-logic.ts
// Backtest 대시보드 전용 훅. Trade 모드는 별도 widgets/trade-dashboard를 사용.
import { useMemo } from 'react';

import { SeriesMarker } from 'lightweight-charts';

import { useBacktestQuery, useStockHistoryQuery } from '@/entities/stock/api/stocks-queries';

import { useDashboardStore } from '../model/dashborad-store';

export const useDashboardLogic = () => {
  const symbol = useDashboardStore((s) => s.symbol);
  const params = useDashboardStore((s) => s.strategyParams);

  const historyQuery = useStockHistoryQuery(symbol);
  const backtestQuery = useBacktestQuery(symbol, params, !!historyQuery.data);

  const { mergedData, markers, backtestLine, trades, winRate } = useMemo(() => {
    const rawData = historyQuery.data?.data;
    const results = backtestQuery.data?.results;

    if (!rawData) return { mergedData: [], markers: [], backtestLine: [], trades: 0, winRate: 0 };
    if (!results)
      return { mergedData: rawData, markers: [], backtestLine: [], trades: 0, winRate: 0 };

    const indicatorMap = new Map(results.map((item: any) => [item.time, item]));
    const generatedMarkers: SeriesMarker<string>[] = [];

    const merged = rawData.map((candle: any) => {
      const indicators = indicatorMap.get(candle.time);

      if (indicators?.action) {
        const isBuy = indicators.action === 'buy';
        generatedMarkers.push({
          time: candle.time,
          position: isBuy ? 'belowBar' : 'aboveBar',
          color: isBuy ? '#006c49' : '#ba1a1a',
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          text: isBuy ? 'BUY' : 'SELL',
          size: 2,
        });
      }

      return {
        ...candle,
        sma_s: indicators?.sma_s,
        sma_l: indicators?.sma_l,
        rsi: indicators?.rsi,
        macd: indicators?.macd,
        macd_h: indicators?.macd_h,
        bb_u: indicators?.bb_u,
        bb_m: indicators?.bb_m,
        bb_l: indicators?.bb_l,
      };
    });

    // 거래 횟수/승률: buy → sell 페어 단위
    let tradeCount = 0;
    let winCount = 0;
    let entryValue: number | null = null;
    for (const r of results as any[]) {
      if (r.action === 'buy') {
        entryValue = r.value;
      } else if (r.action === 'sell' && entryValue !== null) {
        tradeCount++;
        if (r.value > entryValue) winCount++;
        entryValue = null;
      }
    }
    const winRatePct = tradeCount > 0 ? Math.round((winCount / tradeCount) * 100) : 0;

    return {
      mergedData: merged,
      markers: generatedMarkers,
      backtestLine: results,
      trades: tradeCount,
      winRate: winRatePct,
    };
  }, [historyQuery.data, backtestQuery.data]);

  return {
    mergedData,
    markers,
    backtestLine,
    trades,
    winRate,
    companyName: historyQuery.data?.company_name || symbol,
    isLoading: historyQuery.isLoading || backtestQuery.isLoading,
    refetch: () => {
      historyQuery.refetch();
      backtestQuery.refetch();
    },
  };
};
