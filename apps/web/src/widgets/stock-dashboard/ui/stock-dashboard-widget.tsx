'use client';

import { useCallback, useEffect, useState } from 'react';

import { SeriesMarker } from 'lightweight-charts';

import { ChartControls } from '@/features/chart-control/ui/chart-control';
import { StockSearch } from '@/features/stock-search/ui/stock-search';
import { TradeForm } from '@/features/trade-stock/ui/trade-form';

import { getBacktestResult, getStockHistory } from '@/entities/stock/api/stocks-api';
import { ChartOptions, MarketData } from '@/entities/stock/model/stocks-common';
import { StockChart } from '@/entities/stock/ui/stock-chart';

export const StockDashboardWidget = () => {
  const [data, setData] = useState<MarketData[]>([]);
  const [backtestLine, setBacktestLine] = useState<{ time: string; value: number }[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('NVDA');
  const [companyName, setCompanyName] = useState('');

  // ✅ 1. 전략 파라미터 상태 추가
  const [strategyParams, setStrategyParams] = useState({
    sma_short: 10,
    sma_long: 50,
    rsi_buy_k: 60,
  });

  const [indicators, setIndicators] = useState<ChartOptions>({
    volume: true,
    rsi: false,
    macd: false,
    sma: true,
    bollinger: false,
  });

  // ✅ 2. fetchData에서 strategyParams를 사용하도록 수정
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyResponse, backtestResponse] = await Promise.all([
        getStockHistory(symbol),
        getBacktestResult(symbol, strategyParams),
      ]);

      // 1. 기본 시세 데이터 추출
      const rawData =
        'data' in historyResponse
          ? historyResponse.data
          : (historyResponse as unknown as MarketData[]);
      setCompanyName('company_name' in historyResponse ? historyResponse.company_name : '');

      // 2. 백테스트 결과(지표 포함)를 Map으로 변환하여 검색 최적화
      const indicatorMap = new Map();
      backtestResponse.results?.forEach((item: any) => {
        indicatorMap.set(item.time, item);
      });

      // ✅ 3. 시세 데이터와 지표 데이터 병합 (Merge)
      const mergedData = rawData.map((candle) => {
        const indicators = indicatorMap.get(candle.time);
        return {
          ...candle,
          // 백테스트 결과에 지표가 있다면 덮어쓰기
          rsi: indicators?.rsi,
          macd: indicators?.macd,
          macd_h: indicators?.macd_h,
          bb_u: indicators?.bb_u,
          bb_m: indicators?.bb_m,
          bb_l: indicators?.bb_l,
        };
      });

      setData(mergedData); // 이제 차트에 지표가 포함된 데이터가 주입됩니다.
      setBacktestLine(backtestResponse.results || []);
    } catch (err) {
      console.error('Data Merge Error:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, strategyParams]);

  useEffect(() => {
    fetchData();
  }, [symbol]); // 초기 로딩 및 종목 변경시에만 자동 실행 (파라미터 변경시엔 버튼 클릭 유도)

  return (
    <div className="min-h-screen space-y-4 bg-slate-950 p-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-white">
              {companyName || symbol}
            </h1>
            <span className="text-2xl font-bold tracking-tight text-slate-500 uppercase">
              {symbol}
            </span>
            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold tracking-widest text-emerald-500">
              LIVE
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Algorithm:{' '}
            <span className="font-medium text-emerald-400/80">SMA Crossover Strategy</span>
          </p>
        </div>
        <StockSearch onSearch={setSymbol} />
      </div>

      {/* ✅ 3. ChartControls에 상태와 핸들러 연결 */}
      <ChartControls
        options={indicators}
        params={strategyParams}
        onChange={(key) => setIndicators((p) => ({ ...p, [key]: !p[key] }))}
        onParamChange={(key, value) => setStrategyParams((p) => ({ ...p, [key]: value }))}
        onApply={fetchData} // Run Backtest 버튼 클릭 시 실행
      />

      <div className="relative min-h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="animate-pulse font-medium text-emerald-500">Running Backtest Engine...</p>
          </div>
        )}

        {data.length > 0 ? (
          <StockChart
            data={data}
            backtestData={backtestLine}
            markers={markers}
            visibleIndicators={indicators}
          />
        ) : (
          !loading && (
            <div className="flex h-[600px] flex-col items-center justify-center text-slate-500">
              <p className="text-lg">No Market Data Available</p>
              <button onClick={fetchData} className="mt-4 text-emerald-500 hover:underline">
                Retry Connection
              </button>
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <TradeForm
            symbol={symbol}
            currentPrice={data[data.length - 1]?.close || 0}
            onOrderPlaced={fetchData}
          />
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            Backtest Performance
          </h3>
          <div
            className={`text-3xl font-black ${backtestLine.length > 0 && backtestLine[backtestLine.length - 1].value >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {backtestLine.length > 0
              ? `${((backtestLine[backtestLine.length - 1].value - 1) * 100).toFixed(2)}%`
              : '--'}
          </div>
          <p className="mt-1 text-[10px] text-slate-500 uppercase">
            Cumulative Return since inception
          </p>
        </div>
      </div>
    </div>
  );
};
