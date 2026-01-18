// src/entities/stock/lib/strategy.ts
import { MarketData } from '../model/types';
import { calculateSMA, calculateRSI } from './indicators'; // RSI 추가 import
import { SeriesMarker } from 'lightweight-charts';

export function getAdvancedSignals(data: MarketData[]): SeriesMarker<string>[] {
  const sma5 = calculateSMA(data, 5);
  const sma20 = calculateSMA(data, 20);
  const rsi = calculateRSI(data, 14); // RSI 14일

  const markers: SeriesMarker<string>[] = [];
  
  // 데이터 매핑
  const sma5Map = new Map(sma5.map(i => [i.time, i.value]));
  const sma20Map = new Map(sma20.map(i => [i.time, i.value]));
  const rsiMap = new Map(rsi.map(i => [i.time, i.value]));

  for (let i = 20; i < data.length; i++) {
    const today = data[i].time.split('T')[0];
    const yesterday = data[i-1].time.split('T')[0];

    const s5 = sma5Map.get(today);
    const s20 = sma20Map.get(today);
    const prevS5 = sma5Map.get(yesterday);
    const prevS20 = sma20Map.get(yesterday);
    const currentRSI = rsiMap.get(today);

    if (s5 && s20 && prevS5 && prevS20 && currentRSI) {
      
      // ✅ 매수 조건: 골든크로스 AND RSI가 70 미만 (아직 과열 아님)
      if (prevS5 <= prevS20 && s5 > s20 && currentRSI < 70) {
        markers.push({
          time: today, position: 'belowBar', color: '#FFD700', shape: 'arrowUp', text: 'Strong Buy', size: 2
        });
      }

      // 🔻 매도 조건: 데드크로스 OR RSI가 70 이상 찍고 내려올 때 (차익 실현)
      if (prevS5 >= prevS20 && s5 < s20) {
        markers.push({
          time: today, position: 'aboveBar', color: '#A9A9A9', shape: 'arrowDown', text: 'Sell',
        });
      }
    }
  }
  return markers;
}