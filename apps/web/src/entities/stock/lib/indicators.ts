import { MarketData } from "../model/types";

/**
 * 단순 이동평균(SMA) 계산 함수
 * @param data 주가 데이터 배열
 * @param count 기간 (예: 20일)
 */
export function calculateSMA(data: MarketData[], count: number) {
  const avg = (data: MarketData[]) => data.reduce((a, b) => a + b.close, 0) / data.length;
  const result = [];
  for (let i = count - 1; i < data.length; i++) {
    const val = avg(data.slice(i - count + 1, i + 1));
    result.push({ time: data[i].time.split('T')[0], value: val });
  }
  return result;
}