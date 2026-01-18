import { MarketData } from '../model/types';

/**
 * 단순 이동평균(SMA) 계산 함수
 * @param data 주가 데이터 배열
 * @param count 기간 (예: 20일)
 * @returns { time, value } 형태의 배열
 */
export function calculateSMA(data: MarketData[], count: number) {
  const avg = (d: MarketData[]) => d.reduce((a, b) => a + b.close, 0) / d.length;
  const result = [];
  
  for (let i = count - 1; i < data.length; i++) {
    const val = avg(data.slice(i - count + 1, i + 1));
    result.push({ time: data[i].time.split('T')[0], value: val });
  }
  
  return result;
}

/**
 * 표준편차(Standard Deviation) 계산 헬퍼 함수
 * @param data 주가 데이터 배열 (슬라이싱된 데이터)
 * @param count 기간
 */
function calculateStdDev(data: MarketData[], count: number) {
  const mean = data.reduce((a, b) => a + b.close, 0) / count;
  const variance = data.reduce((a, b) => a + Math.pow(b.close - mean, 2), 0) / count;
  return Math.sqrt(variance);
}

/**
 * 볼린저 밴드(Bollinger Bands) 계산 함수
 * - 주가의 변동성을 기준으로 상한선과 하한선을 계산합니다.
 * @param data 주가 데이터 배열
 * @param count 이동평균 기간 (기본값: 20일)
 * @param multiplier 표준편차 승수 (기본값: 2)
 * @returns { time, upper, lower } 형태의 배열
 */
export function calculateBollingerBands(data: MarketData[], count = 20, multiplier = 2) {
  const result = [];
  for (let i = count - 1; i < data.length; i++) {
    const slice = data.slice(i - count + 1, i + 1);
    
    // 중심선 (Mid Band) = 단순 이동평균
    const sma = slice.reduce((a, b) => a + b.close, 0) / count;
    const stdDev = calculateStdDev(slice, count);

    result.push({
      time: data[i].time.split('T')[0],
      upper: sma + stdDev * multiplier, // 상한선
      lower: sma - stdDev * multiplier, // 하한선
    });
  }
  return result;
}

/**
 * RSI(상대강도지수) 계산 함수
 * - 현재 추세의 강도를 백분율(0~100)로 나타냅니다.
 * - 일반적으로 70 이상을 과매수, 30 이하를 과매도로 판단합니다.
 * @param data 주가 데이터 배열
 * @param count 기간 (기본값: 14일)
 * @returns { time, value } 형태의 배열
 */
export function calculateRSI(data: MarketData[], count = 14) {
  const result = [];
  let gains = 0;
  let losses = 0;

  // 1. 첫 RSI 계산을 위한 초기 평균 승/패 계산 (단순 평균)
  for (let i = 1; i <= count; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / count;
  let avgLoss = losses / count;

  // 2. 이후 데이터에 대해 Wilder's Smoothing 기법 적용
  for (let i = count; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    
    if (change > 0) {
      avgGain = (avgGain * (count - 1) + change) / count;
      avgLoss = (avgLoss * (count - 1)) / count;
    } else {
      avgGain = (avgGain * (count - 1)) / count;
      avgLoss = (avgLoss * (count - 1) + Math.abs(change)) / count;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    result.push({ time: data[i].time.split('T')[0], value: rsi });
  }
  return result;
}