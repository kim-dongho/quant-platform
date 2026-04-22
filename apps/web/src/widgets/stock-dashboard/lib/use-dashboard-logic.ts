// apps/web/src/widgets/stock-dashboard/lib/use-dashboard-logic.ts
import { useEffect, useMemo, useState } from 'react';

import { SeriesMarker } from 'lightweight-charts';

// API & Store
import { useBacktestQuery, useStockHistoryQuery } from '@/entities/stock/api/stocks-queries';
import { MarketData } from '@/entities/stock/model/stocks-common';

// 타입 경로 확인

// CSV 파서
import { parseCSV } from '@/shared/lib/csv-parser';

import { useDashboardStore } from '../model/dashborad-store';

export type DashboardMode = 'backtest' | 'trade';

export const useDashboardLogic = (mode: DashboardMode) => {
  const symbol = useDashboardStore((s) => s.symbol);
  const params = useDashboardStore((s) => s.strategyParams);

  // ----------------------------------------------------------------
  // 1. [Backtest Mode] 일봉 API 데이터 (기존 로직)
  // ----------------------------------------------------------------
  const isBacktest = mode === 'backtest';
  const historyQuery = useStockHistoryQuery(symbol, { enabled: isBacktest });
  const backtestQuery = useBacktestQuery(symbol, params, isBacktest && !!historyQuery.data);

  // ----------------------------------------------------------------
  // 2. [Trade Mode] 1분봉 CSV/API 데이터
  // ----------------------------------------------------------------
  const [tradeData, setTradeData] = useState<MarketData[]>([]);
  const [isTradeLoading, setIsTradeLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'trade') return; // 트레이드 모드일 때만 실행

    const loadIntradayData = async () => {
      setIsTradeLoading(true);
      try {
        // 나중에는 여기서 '/api/candles?tf=1m'을 호출하면 됩니다.
        const res = await fetch('/RKLB_1m.csv');
        if (!res.ok) throw new Error('Failed to load intraday data');

        const text = await res.text();
        const parsed = parseCSV(text);

        // 타입 보정
        const formatted = parsed.map((p) => ({
          ...p,
          symbol: symbol || 'RKLB',
          volume: p.volume ?? 0,
        })) as unknown as MarketData[];

        setTradeData(formatted);
      } catch (e) {
        console.error(e);
      } finally {
        setIsTradeLoading(false);
      }
    };

    loadIntradayData();
  }, [mode, symbol]);

  // ----------------------------------------------------------------
  // 3. 데이터 병합 및 리턴 (모드별 분기)
  // ----------------------------------------------------------------
  const { mergedData, markers, backtestLine, trades, winRate } = useMemo(() => {
    // (A) Trade Mode: 1분봉만 보여줌 (백테스트 라인 없음)
    if (mode === 'trade') {
      return {
        mergedData: tradeData,
        markers: [], // 필요하면 매매 타점 마커 추가 가능
        backtestLine: [], // 실전 매매에선 수익률 그래프 보통 안 봄
        trades: 0,
        winRate: 0,
      };
    }

    // (B) Backtest Mode: 일봉 + 전략 지표 + 수익률 라인 (기존 로직)
    const rawData = historyQuery.data?.data;
    const results = backtestQuery.data?.results;

    if (!rawData) return { mergedData: [], markers: [], backtestLine: [], trades: 0, winRate: 0 };
    if (!results)
      return { mergedData: rawData, markers: [], backtestLine: [], trades: 0, winRate: 0 };

    const indicatorMap = new Map(results.map((item: any) => [item.time, item]));
    const generatedMarkers: SeriesMarker<string>[] = [];

    const merged = rawData.map((candle: any) => {
      const indicators = indicatorMap.get(candle.time);

      // 매매 신호 마커
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

    // 거래 횟수/승률 계산: buy → sell 페어 단위로, sell 시점 누적수익이
    // buy 시점 누적수익보다 크면 승. 마지막 buy가 아직 청산 안 됐으면 제외.
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
  }, [mode, tradeData, historyQuery.data, backtestQuery.data]);

  return {
    mergedData,
    markers,
    backtestLine,
    trades,
    winRate,
    companyName: mode === 'trade' ? symbol : historyQuery.data?.company_name || symbol,
    isLoading:
      mode === 'trade' ? isTradeLoading : historyQuery.isLoading || backtestQuery.isLoading,
    currentPrice: mergedData.length > 0 ? mergedData[mergedData.length - 1].close : 0,
    refetch: () => {
      if (mode === 'trade') window.location.reload();
      else {
        historyQuery.refetch();
        backtestQuery.refetch();
      }
    },
  };
};
