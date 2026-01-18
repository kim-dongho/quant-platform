import { MarketData } from '../model/types';
import { calculateSMA } from './indicators'; // 아까 만든 SMA 함수 재사용
import { SeriesMarker } from 'lightweight-charts';

/**
 * 골든크로스 전략 (5일선 > 20일선 돌파 시 매수 신호)
 */
export function getGoldenCrossSignals(data: MarketData[]): SeriesMarker<string>[] {
  const sma5 = calculateSMA(data, 5);
  const sma20 = calculateSMA(data, 20);
  
  const markers: SeriesMarker<string>[] = [];

  // 데이터 매칭을 위해 Map으로 변환 (날짜 -> 값)
  const sma5Map = new Map(sma5.map(i => [i.time, i.value]));
  const sma20Map = new Map(sma20.map(i => [i.time, i.value]));

  // SMA 20일 데이터가 있는 시점부터 루프 시작 (그 전엔 골든크로스 계산 불가)
  for (let i = 20; i < data.length; i++) {
    const today = data[i].time.split('T')[0];
    const yesterday = data[i-1].time.split('T')[0];

    const todaySMA5 = sma5Map.get(today);
    const todaySMA20 = sma20Map.get(today);
    const prevSMA5 = sma5Map.get(yesterday);
    const prevSMA20 = sma20Map.get(yesterday);

    // 값이 다 존재할 때만 계산
    if (todaySMA5 && todaySMA20 && prevSMA5 && prevSMA20) {
      
      // ✅ 골든크로스 조건: 어제는 5일선이 20일선 아래였는데, 오늘은 위로 뚫음
      if (prevSMA5 <= prevSMA20 && todaySMA5 > todaySMA20) {
        markers.push({
          time: today,
          position: 'belowBar', // 캔들 아래에 표시
          color: '#FFD700',     // 황금색 (Golden Cross)
          shape: 'arrowUp',
          text: 'Golden Cross', // 마커 텍스트
          size: 2,
        });
      }
      
      // (선택) 데드크로스 조건: 5일선이 20일선 아래로 떨어짐 -> 매도 신호
      if (prevSMA5 >= prevSMA20 && todaySMA5 < todaySMA20) {
        markers.push({
          time: today,
          position: 'aboveBar',
          color: '#A9A9A9',     // 회색
          shape: 'arrowDown',
          text: 'Dead Cross',
        });
      }
    }
  }

  return markers;
}