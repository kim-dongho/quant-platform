import { MarketData } from "../model/stocks-common";

/**
 * 단순 이동평균(SMA) 계산 함수
 * @param data 주가 데이터 배열
 * @param count 기간 (예: 20일)
 * @returns { time, value } 형태의 배열
 */
export function calculateSMA(data: MarketData[], count: number) {
  const result = [];
  
  for (let i = count - 1; i < data.length; i++) {
    const slice = data.slice(i - count + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b.close, 0);
    result.push({ time: data[i].time, value: sum / count });
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
    
    const sma = slice.reduce((a, b) => a + b.close, 0) / count;
    const stdDev = calculateStdDev(slice, count);

    result.push({
      time: data[i].time,
      upper: sma + stdDev * multiplier,
      lower: sma - stdDev * multiplier,
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
  if (data.length <= count) return [];

  const result = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= count; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / count;
  let avgLoss = losses / count;

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

    result.push({ time: data[i].time, value: rsi });
  }
  return result;
}

/**
 * 지수 이동평균(EMA) 헬퍼 함수
 */
function calculateEMA(data: { time: string; value: number }[], count: number) {
  const k = 2 / (count + 1);
  const result = [];
  let ema = data[0].value;

  for (let i = 0; i < data.length; i++) {
    ema = data[i].value * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

/**
 * MACD 계산 함수 (12, 26, 9)
 * @returns { histogram, macd, signal }
 */
export function calculateMACD(data: MarketData[]) {
  if (data.length < 26) return { macd: [], signal: [], histogram: [] };

  const closeData = data.map(d => ({ time: d.time, value: d.close }));
  
  const ema12 = calculateEMA(closeData, 12);
  const ema26 = calculateEMA(closeData, 26);

  const macdLine = [];
  for (let i = 0; i < closeData.length; i++) {
    const val12 = ema12[i]?.value || 0;
    const val26 = ema26[i]?.value || 0;
    macdLine.push({ time: closeData[i].time, value: val12 - val26 });
  }

  const signalLine = calculateEMA(macdLine, 9);
  const histogram = macdLine.map((m, i) => ({
    time: m.time,
    value: m.value - (signalLine[i]?.value || 0)
  }));

  return { macd: macdLine, signal: signalLine, histogram };
}