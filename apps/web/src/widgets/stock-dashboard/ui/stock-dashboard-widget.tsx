'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChartOptions, MarketData } from '@/entities/stock/model/stocks-common';
import { StockChart } from '@/entities/stock/ui/stock-chart';
import { SeriesMarker } from 'lightweight-charts';
import { getBacktestResult, getStockHistory } from '@/entities/stock/api/stocks-api'; 
import { StockSearch } from '@/features/stock-search/ui/stock-search';
import { TradeForm } from '@/features/trade-stock/ui/trade-form';
import { ChartControls } from '@/features/chart-control/ui/chart-control';

export const StockDashboardWidget = () => {
  const [data, setData] = useState<MarketData[]>([]);
  const [backtestLine, setBacktestLine] = useState<{time: string, value: number}[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('NVDA');

  const [indicators, setIndicators] = useState<ChartOptions>({ 
    volume: true, rsi: false, macd: false, sma: true , bollinger: false
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 시세와 백테스트 데이터를 병렬로 호출
      const [history, backtestResponse] = await Promise.all([
        getStockHistory(symbol),
        getBacktestResult(symbol, {
          use_sma: true,
          sma_short: 10,
          sma_long: 50,
          rsi_buy_k: 60
        })
      ]);

      // Go 백엔드 데이터 주입 (캔들스틱)
      setData(history);

      // Python 엔진 데이터 주입 (수익률 선)
      setBacktestLine(backtestResponse.results || []);
    } catch (err) {
      console.error("Dashboard Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-4 p-6 bg-slate-950 min-h-screen">
      <div className="flex justify-between items-end">
        <div>
           <div className="flex items-center gap-3">
             <h1 className="text-4xl font-black text-white tracking-tighter">{symbol}</h1>
             <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs rounded border border-emerald-500/20 font-bold">LIVE</span>
           </div>
           <p className="text-slate-400 text-sm mt-1">Algorithm: <span className="text-slate-200">SMA Crossover Strategy</span></p>
        </div>
        <StockSearch onSearch={setSymbol} />
      </div>

     <ChartControls options={indicators} onChange={(key) => setIndicators(p => ({...p, [key]: !p[key]}))} />
     
      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-2xl relative min-h-[600px]">
        {loading && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20 backdrop-blur-sm">
             <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
             <p className="text-emerald-500 font-medium animate-pulse">Running Backtest Engine...</p>
           </div>
        )}
        
        {/* 데이터가 로드된 후에만 차트 렌더링 */}
        {data.length > 0 ? (
          <StockChart 
            data={data} 
            backtestData={backtestLine}
            markers={markers} 
            visibleIndicators={indicators}
          />
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center h-[600px] text-slate-500">
              <p className="text-lg">No Market Data Available</p>
              <button onClick={fetchData} className="mt-4 text-emerald-500 hover:underline">Retry Connection</button>
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
            <TradeForm symbol={symbol} currentPrice={344.26} onOrderPlaced={fetchData} />
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-slate-400 text-sm font-bold mb-2">Backtest Summary</h3>
            <div className="text-2xl font-bold text-white">
                {backtestLine.length > 0 ? 
                  `+${((backtestLine[backtestLine.length-1].value - 1) * 100).toFixed(2)}%` : '--'}
            </div>
            <p className="text-xs text-slate-500 mt-1">Based on last 1 year data</p>
        </div>
      </div>
    </div>
  );
};