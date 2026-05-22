// 차트용 장기 채널 계산 — 외부 데이터 fetch 없이 frontend 에서 OHLCV 만으로 산출.
// 세 가지 채널을 동일 시계열에 겹쳐 그려 시각적으로 비교 가능하게 함.
//
//  A) Linear Regression Channel: 마지막 N봉에 OLS 회귀선 + 잔차의 ±k×σ
//  B) Donchian Channel: rolling N봉 high/low
//  C) Pivot Trendline: N봉 중 swing high/low 검출 후 최근 2점 연결한 직선
//
// 모든 값은 chart series 좌표 (time + value) 배열 형태로 반환.
import type { MarketData } from '../model/stocks-common';

export interface ChannelPoint {
  time: string | number;
  value: number;
}

// ───────────────────────────────────────────────────────────
// A) Linear Regression Channel
// ───────────────────────────────────────────────────────────
export function computeLinearRegressionChannel(
  data: MarketData[],
  period: number = 250,
  k: number = 2,
): { upper: ChannelPoint[]; mid: ChannelPoint[]; lower: ChannelPoint[] } {
  if (data.length < 2) return { upper: [], mid: [], lower: [] };

  const tail = data.slice(-period);
  const n = tail.length;
  const xs = tail.map((_, i) => i);
  const ys = tail.map((d) => d.close);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const fitted = xs.map((x) => intercept + slope * x);
  const sse = ys.reduce((acc, y, i) => acc + (y - fitted[i]) ** 2, 0);
  const stdev = Math.sqrt(sse / Math.max(n - 2, 1));

  const mid: ChannelPoint[] = [];
  const upper: ChannelPoint[] = [];
  const lower: ChannelPoint[] = [];
  for (let i = 0; i < n; i++) {
    const m = fitted[i];
    mid.push({ time: tail[i].time, value: m });
    upper.push({ time: tail[i].time, value: m + k * stdev });
    lower.push({ time: tail[i].time, value: m - k * stdev });
  }
  return { upper, mid, lower };
}

// ───────────────────────────────────────────────────────────
// A') Standard Error Channel — 회귀선 ± k × (σ / √n)
// ───────────────────────────────────────────────────────────
// LR Channel 의 ±σ 는 "가격 변동의 범위", SE Channel 의 ±SE 는
// "회귀선 위치의 신뢰구간" — 매우 좁고 추세선의 정확도를 시각화.
export function computeStandardErrorChannel(
  data: MarketData[],
  period: number = 130,
  k: number = 2,
): { upper: ChannelPoint[]; lower: ChannelPoint[] } {
  if (data.length < 2) return { upper: [], lower: [] };

  const tail = data.slice(-period);
  const n = tail.length;
  const xs = tail.map((_, i) => i);
  const ys = tail.map((d) => d.close);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const fitted = xs.map((x) => intercept + slope * x);
  const sse = ys.reduce((acc, y, i) => acc + (y - fitted[i]) ** 2, 0);
  const stdev = Math.sqrt(sse / Math.max(n - 2, 1));
  const se = stdev / Math.sqrt(n); // SE = σ/√n

  const upper: ChannelPoint[] = [];
  const lower: ChannelPoint[] = [];
  for (let i = 0; i < n; i++) {
    upper.push({ time: tail[i].time, value: fitted[i] + k * se });
    lower.push({ time: tail[i].time, value: fitted[i] - k * se });
  }
  return { upper, lower };
}

// ───────────────────────────────────────────────────────────
// B) Donchian Channel — rolling N-bar high/low
// ───────────────────────────────────────────────────────────
export function computeDonchianChannel(
  data: MarketData[],
  period: number = 60,
): { upper: ChannelPoint[]; lower: ChannelPoint[] } {
  const upper: ChannelPoint[] = [];
  const lower: ChannelPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let mx = -Infinity;
    let mn = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].high > mx) mx = data[j].high;
      if (data[j].low < mn) mn = data[j].low;
    }
    upper.push({ time: data[i].time, value: mx });
    lower.push({ time: data[i].time, value: mn });
  }
  return { upper, lower };
}

// ───────────────────────────────────────────────────────────
// B') Keltner Channel — EMA ± k × ATR (변동성 기반)
// ───────────────────────────────────────────────────────────
// σ 대신 ATR (Average True Range) 사용 — 갭이나 고가-저가 범위 반영해
// Bollinger 보다 robust. trend following 표준 (CTA 자주 사용).
export function computeKeltnerChannel(
  data: MarketData[],
  emaPeriod: number = 20,
  atrPeriod: number = 20,
  k: number = 2,
): { upper: ChannelPoint[]; mid: ChannelPoint[]; lower: ChannelPoint[] } {
  if (data.length < Math.max(emaPeriod, atrPeriod) + 1) {
    return { upper: [], mid: [], lower: [] };
  }

  // EMA(close, emaPeriod) — 초기값은 처음 emaPeriod 의 SMA
  const closes = data.map((d) => d.close);
  const ema: number[] = [];
  const multiplier = 2 / (emaPeriod + 1);
  for (let i = 0; i < closes.length; i++) {
    if (i < emaPeriod - 1) {
      ema.push(NaN);
    } else if (i === emaPeriod - 1) {
      const sma = closes.slice(0, emaPeriod).reduce((a, b) => a + b, 0) / emaPeriod;
      ema.push(sma);
    } else {
      ema.push(closes[i] * multiplier + ema[i - 1] * (1 - multiplier));
    }
  }

  // ATR(atrPeriod) — Wilder's smoothing
  // TR = max(H-L, |H-prev_close|, |L-prev_close|)
  const tr: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low);
    } else {
      const hl = data[i].high - data[i].low;
      const hc = Math.abs(data[i].high - data[i - 1].close);
      const lc = Math.abs(data[i].low - data[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
  }
  const atr: number[] = [];
  for (let i = 0; i < tr.length; i++) {
    if (i < atrPeriod - 1) {
      atr.push(NaN);
    } else if (i === atrPeriod - 1) {
      atr.push(tr.slice(0, atrPeriod).reduce((a, b) => a + b, 0) / atrPeriod);
    } else {
      atr.push((atr[i - 1] * (atrPeriod - 1) + tr[i]) / atrPeriod);
    }
  }

  const upper: ChannelPoint[] = [];
  const mid: ChannelPoint[] = [];
  const lower: ChannelPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Number.isNaN(ema[i]) || Number.isNaN(atr[i])) continue;
    upper.push({ time: data[i].time, value: ema[i] + k * atr[i] });
    mid.push({ time: data[i].time, value: ema[i] });
    lower.push({ time: data[i].time, value: ema[i] - k * atr[i] });
  }
  return { upper, mid, lower };
}

// ───────────────────────────────────────────────────────────
// C) Pivot Trendline — swing high/low 검출 후 최근 2점 연결
// ───────────────────────────────────────────────────────────
// pivot 검출: 좌우 window 봉 모두보다 high 가 크면 swing high (low 도 동일).
// 최근 2개 swing high / swing low 를 잇는 직선 = 저항선 / 지지선.
export function computePivotTrendlines(
  data: MarketData[],
  period: number = 250,
  window: number = 5,
): { resistance: ChannelPoint[]; support: ChannelPoint[] } {
  if (data.length < window + 1) return { resistance: [], support: [] };

  const tail = data.slice(-period);

  const pivotHighs: { idx: number; price: number }[] = [];
  const pivotLows: { idx: number; price: number }[] = [];

  // 우측 window 비대칭 — 마지막 봉 근처도 잠정 pivot 으로.
  for (let i = window; i < tail.length; i++) {
    const rightW = Math.min(window, tail.length - 1 - i);
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + rightW; j++) {
      if (j === i) continue;
      if (tail[j].high >= tail[i].high) isHigh = false;
      if (tail[j].low <= tail[i].low) isLow = false;
    }
    if (isHigh) pivotHighs.push({ idx: i, price: tail[i].high });
    if (isLow) pivotLows.push({ idx: i, price: tail[i].low });
  }

  const resistance: ChannelPoint[] = [];
  if (pivotHighs.length >= 2) {
    const a = pivotHighs[pivotHighs.length - 2];
    const b = pivotHighs[pivotHighs.length - 1];
    const slope = (b.price - a.price) / (b.idx - a.idx);
    for (let i = a.idx; i < tail.length; i++) {
      resistance.push({ time: tail[i].time, value: a.price + slope * (i - a.idx) });
    }
  }

  const support: ChannelPoint[] = [];
  if (pivotLows.length >= 2) {
    const a = pivotLows[pivotLows.length - 2];
    const b = pivotLows[pivotLows.length - 1];
    const slope = (b.price - a.price) / (b.idx - a.idx);
    for (let i = a.idx; i < tail.length; i++) {
      support.push({ time: tail[i].time, value: a.price + slope * (i - a.idx) });
    }
  }

  return { resistance, support };
}

// ───────────────────────────────────────────────────────────
// D) Andrews' Pitchfork — 3 swing point 기반 미디언선 + 평행 채널
// ───────────────────────────────────────────────────────────
// P0 = 가장 최근 추세 시작점, P1 / P2 = 그 이후 alternating swing.
// 미디언선: P0 → midpoint(P1, P2). 평행 상단: P1 시작 + 미디언 기울기.
// 평행 하단: P2 시작 + 미디언 기울기. 미디언선이 magnet 역할 — 가격이
// 자주 회귀하는 중심.
export function computeAndrewsPitchfork(
  data: MarketData[],
  period: number = 250,
  window: number = 5,
): { upper: ChannelPoint[]; median: ChannelPoint[]; lower: ChannelPoint[] } {
  if (data.length < window + 1) return { upper: [], median: [], lower: [] };

  const tail = data.slice(-period);

  // alternating swing detection — high → low → high → low ... 순서로 누적.
  // 우측 window 비대칭 — 마지막 봉 근처 swing 도 잠정 pivot 으로 인정.
  const pivots: { idx: number; price: number; type: 'H' | 'L' }[] = [];
  for (let i = window; i < tail.length; i++) {
    const rightW = Math.min(window, tail.length - 1 - i);
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + rightW; j++) {
      if (j === i) continue;
      if (tail[j].high >= tail[i].high) isHigh = false;
      if (tail[j].low <= tail[i].low) isLow = false;
    }
    if (isHigh) {
      // 직전 pivot 이 'H' 면 더 높은 쪽 유지 (HH 패턴 처리)
      const last = pivots[pivots.length - 1];
      if (!last || last.type === 'L') {
        pivots.push({ idx: i, price: tail[i].high, type: 'H' });
      } else if (last.type === 'H' && tail[i].high > last.price) {
        pivots[pivots.length - 1] = { idx: i, price: tail[i].high, type: 'H' };
      }
    }
    if (isLow) {
      const last = pivots[pivots.length - 1];
      if (!last || last.type === 'H') {
        pivots.push({ idx: i, price: tail[i].low, type: 'L' });
      } else if (last.type === 'L' && tail[i].low < last.price) {
        pivots[pivots.length - 1] = { idx: i, price: tail[i].low, type: 'L' };
      }
    }
  }

  if (pivots.length < 3) return { upper: [], median: [], lower: [] };

  const [p0, p1, p2] = pivots.slice(-3);

  // 미디언선: P0 → midpoint(P1, P2)
  const midIdx = (p1.idx + p2.idx) / 2;
  const midPrice = (p1.price + p2.price) / 2;
  const dx = midIdx - p0.idx;
  if (dx === 0) return { upper: [], median: [], lower: [] };
  const slope = (midPrice - p0.price) / dx;

  const upper: ChannelPoint[] = [];
  const median: ChannelPoint[] = [];
  const lower: ChannelPoint[] = [];

  // P0 부터 마지막 봉까지 미디언선 + 평행선 그림.
  // 상단 = P1 가격 기준 같은 기울기, 하단 = P2 가격 기준.
  for (let i = p0.idx; i < tail.length; i++) {
    median.push({ time: tail[i].time, value: p0.price + slope * (i - p0.idx) });
    upper.push({ time: tail[i].time, value: p1.price + slope * (i - p1.idx) });
    lower.push({ time: tail[i].time, value: p2.price + slope * (i - p2.idx) });
  }

  return { upper, median, lower };
}

// ───────────────────────────────────────────────────────────
// E) Higher Highs / Higher Lows 자동 Trendline (Dow 이론)
// ───────────────────────────────────────────────────────────
// pivot high 들 중 단조 증가만 연결 (상단), pivot low 들 중 단조 증가 연결 (하단).
// 둘 다 monotonic 이면 uptrend, 둘 다 감소면 downtrend. 추세가 깨졌다 = 가장 최근
// HH (또는 HL) 의 연속성이 무너졌다 — Dow 이론의 추세 정의.
//
// 단순 구현: 가장 최근 unbroken monotonic subsequence 의 첫 점과 마지막 점 연결.
export function computeHHHLTrendline(
  data: MarketData[],
  period: number = 250,
  window: number = 5,
): { hhLine: ChannelPoint[]; hlLine: ChannelPoint[] } {
  if (data.length < window + 1) return { hhLine: [], hlLine: [] };

  const tail = data.slice(-period);

  // 우측 window 는 가능한 만큼만 (비대칭) — 마지막 봉 근처의 swing 도 잠정 pivot 으로
  // 검출. 안 그러면 현재 진행 중인 추세가 차트에 안 그려져 답답함.
  const pivotHighs: { idx: number; price: number }[] = [];
  const pivotLows: { idx: number; price: number }[] = [];
  for (let i = window; i < tail.length; i++) {
    const rightW = Math.min(window, tail.length - 1 - i);
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + rightW; j++) {
      if (j === i) continue;
      if (tail[j].high >= tail[i].high) isHigh = false;
      if (tail[j].low <= tail[i].low) isLow = false;
    }
    if (isHigh) pivotHighs.push({ idx: i, price: tail[i].high });
    if (isLow) pivotLows.push({ idx: i, price: tail[i].low });
  }

  // 뒤에서부터 단조 증가 (HH) 연속 부분 찾기. 가격이 직전보다 낮으면 중단.
  const findMonotonic = (
    arr: { idx: number; price: number }[],
    increasing: boolean,
  ): { idx: number; price: number }[] => {
    if (arr.length < 2) return [];
    const out: { idx: number; price: number }[] = [arr[arr.length - 1]];
    for (let i = arr.length - 2; i >= 0; i--) {
      const last = out[out.length - 1];
      if (increasing ? arr[i].price < last.price : arr[i].price > last.price) {
        out.push(arr[i]);
      } else {
        break;
      }
    }
    return out.reverse();
  };

  const hhSeq = findMonotonic(pivotHighs, true);
  const hlSeq = findMonotonic(pivotLows, true);

  const buildLine = (seq: { idx: number; price: number }[]): ChannelPoint[] => {
    if (seq.length < 2) return [];
    const a = seq[0];
    const b = seq[seq.length - 1];
    const slope = (b.price - a.price) / (b.idx - a.idx);
    const line: ChannelPoint[] = [];
    for (let i = a.idx; i < tail.length; i++) {
      line.push({ time: tail[i].time, value: a.price + slope * (i - a.idx) });
    }
    return line;
  };

  return { hhLine: buildLine(hhSeq), hlLine: buildLine(hlSeq) };
}

// ───────────────────────────────────────────────────────────
// F) Horizontal Support / Resistance Levels — 직전 swing high/low 가로선
// ───────────────────────────────────────────────────────────
// 채널 돌파 시 다음 타겟은 보통 직전 swing high/low. "장대양봉 위 어디까지?" 의
// 가장 정직한 답 — 실제로 가격이 닿았던 곳. 최근 N pivot 의 가격 레벨을 가로
// 점선으로 표시 (시간 무관).
//
// 반환: levels[]. 각 level 은 시작-끝 time 으로 가로선.
export function computeHorizontalLevels(
  data: MarketData[],
  period: number = 250,
  window: number = 5,
  maxLevels: number = 4,
): { resistanceLevels: ChannelPoint[][]; supportLevels: ChannelPoint[][] } {
  if (data.length < window + 1) {
    return { resistanceLevels: [], supportLevels: [] };
  }

  const tail = data.slice(-period);

  // 우측 window 비대칭 — 마지막 봉 근처 swing 도 잠정 pivot 으로 인정.
  const pivotHighs: { idx: number; price: number }[] = [];
  const pivotLows: { idx: number; price: number }[] = [];
  for (let i = window; i < tail.length; i++) {
    const rightW = Math.min(window, tail.length - 1 - i);
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + rightW; j++) {
      if (j === i) continue;
      if (tail[j].high >= tail[i].high) isHigh = false;
      if (tail[j].low <= tail[i].low) isLow = false;
    }
    if (isHigh) pivotHighs.push({ idx: i, price: tail[i].high });
    if (isLow) pivotLows.push({ idx: i, price: tail[i].low });
  }

  // 가장 최근 maxLevels 개만 — 너무 옛날 레벨은 의미 약함.
  const recentHighs = pivotHighs.slice(-maxLevels);
  const recentLows = pivotLows.slice(-maxLevels);

  // 각 pivot 의 가격을 그 pivot 부터 마지막 봉까지 가로선으로.
  const makeLevel = (p: { idx: number; price: number }): ChannelPoint[] => {
    const line: ChannelPoint[] = [];
    for (let i = p.idx; i < tail.length; i++) {
      line.push({ time: tail[i].time, value: p.price });
    }
    return line;
  };

  return {
    resistanceLevels: recentHighs.map(makeLevel),
    supportLevels: recentLows.map(makeLevel),
  };
}
