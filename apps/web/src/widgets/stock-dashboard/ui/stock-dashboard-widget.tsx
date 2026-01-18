'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChartOptions, MarketData } from '@/entities/stock/model/types';
import { getStockHistory } from '@/entities/stock/api/stocks';
import { StockChart } from '@/entities/stock/ui/stock-chart';
import { SeriesMarker } from 'lightweight-charts';
import { getAdvancedSignals } from '@/entities/stock/lib/strategy';
import { StockSearch } from '@/features/stock-search/ui/stock-search';
import { TradeForm } from '@/features/trade-stock/ui/trade-form';
import { ChartControls } from '@/features/chart-control/ui/chart-control';

export const StockDashboardWidget = () => {
  const [data, setData] = useState<MarketData[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('RKLB');

  const [indicators, setIndicators] = useState<ChartOptions>({ 
    volume: true, rsi: false, macd: false, bollinger: true 
  });
  
  const toggleIndicator = (key: keyof ChartOptions) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchData = useCallback(async () => {
    try {
      const history = await getStockHistory(symbol);
      setData(history);

      const algoMarkers = getAdvancedSignals(history);
      
      setMarkers(algoMarkers);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="text-white">Loading Widget...</div>;

 return (
    <div className="space-y-4">
      {/* 상단 헤더 영역: 검색바 + 현재 종목 정보 */}
      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-bold text-white mb-1">{symbol}</h1>
           <span className="text-gray-400 text-sm">Quant Dashboard</span>
        </div>
        
        {/* 검색바 배치 */}
        <StockSearch onSearch={setSymbol} />
      </div>

     <ChartControls options={indicators} onChange={toggleIndicator} />
     
      {/* 차트 영역 */}
      <div className="border border-gray-800 rounded-xl overflow-hidden bg-[#111] relative min-h-[500px]">
        {loading && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 text-white">
             Loading {symbol}...
           </div>
        )}
        
        {data.length > 0 ? (
          <StockChart data={data} markers={markers} visibleIndicators={indicators}/>
        ) : (
          !loading && <div className="text-gray-500 text-center py-20">No Data for {symbol}</div>
        )}
      </div>

      {/* 매매 폼 */}
      <TradeForm 
        symbol={symbol} 
        currentPrice={110} 
        onOrderPlaced={fetchData} 
      />
    </div>
  );
};