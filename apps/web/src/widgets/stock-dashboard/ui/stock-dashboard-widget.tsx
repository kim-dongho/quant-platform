'use client';

import { useCallback, useEffect, useState } from 'react';
import { MarketData } from '@/entities/stock/model/types';
import { getStockHistory } from '@/entities/stock/api/stocks';
import { StockChart } from '@/entities/stock/ui/stock-chart';
import { SeriesMarker } from 'lightweight-charts';
import { getGoldenCrossSignals } from '@/entities/stock/lib/strategy';

export const StockDashboardWidget = () => {
  const [data, setData] = useState<MarketData[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<string>[]>([]);
  const [loading, setLoading] = useState(true);
  const symbol = 'RKLB';

const fetchData = useCallback(async () => {
    try {
      // 1. 데이터 가져오기
      const history = await getStockHistory(symbol);
      setData(history);

      // 2. 전략 실행 (백테스팅 결과 생성) 🤖
      const algoMarkers = getGoldenCrossSignals(history);
      
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
    <div className="border border-gray-800 rounded-xl overflow-hidden bg-[#111]">
      {data.length > 0 ? <StockChart data={data} markers={markers} /> : <div>No Data</div>}
    </div>
  );
};