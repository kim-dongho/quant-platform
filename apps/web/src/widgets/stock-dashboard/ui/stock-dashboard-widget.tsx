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
  // ✅ 1. 회사명 상태 추가
  const [companyName, setCompanyName] = useState('');
  
  const [indicators, setIndicators] = useState<ChartOptions>({ 
    volume: true, rsi: false, macd: false, sma: true , bollinger: false
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyResponse, backtestResponse] = await Promise.all([
        getStockHistory(symbol),
        getBacktestResult(symbol, {
          use_sma: true,
          sma_short: 10,
          sma_long: 50,
          rsi_buy_k: 60
        })
      ]);

      // ✅ 2. 응답 구조 변경 반영 (historyResponse.data, historyResponse.company_name)
      // 만약 백엔드에서 아직 이전 구조(배열)를 보낸다면 방어 로직 적용
      if ('data' in historyResponse) {
        setData(historyResponse.data);
        setCompanyName(historyResponse.company_name);
      } else {
        // 하위 호환성 유지 (백엔드 수정 전 대비)
        setData(historyResponse as unknown as MarketData[]);
        setCompanyName('');
      }

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
      {/* ✅ 3. 헤더 UI 개선: 회사명과 티커를 명확히 구분 */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
           <div className="flex items-center gap-3">
             <h1 className="text-4xl font-black text-white tracking-tighter">
                {companyName || symbol}
             </h1>
             <span className="text-2xl font-bold text-slate-500 tracking-tight uppercase">
                {symbol}
             </span>
             <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] rounded border border-emerald-500/20 font-bold tracking-widest">
                LIVE
             </span>
           </div>
           <p className="text-slate-400 text-sm">
             Algorithm: <span className="text-emerald-400/80 font-medium">SMA Crossover Strategy</span>
           </p>
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
            <TradeForm symbol={symbol} currentPrice={data[data.length-1]?.close || 0} onOrderPlaced={fetchData} />
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
            <h3 className="text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Backtest Performance</h3>
            <div className={`text-3xl font-black ${backtestLine.length > 0 && backtestLine[backtestLine.length-1].value >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {backtestLine.length > 0 ? 
                  `${((backtestLine[backtestLine.length-1].value - 1) * 100).toFixed(2)}%` : '--'}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase">Cumulative Return since inception</p>
        </div>
      </div>
    </div>
  );
};