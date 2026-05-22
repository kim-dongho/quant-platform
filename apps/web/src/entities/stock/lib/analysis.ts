// 차트 데이터에서 분석 metric 추출 — 채널 함수들의 마지막 봉 기준 값을
// 모아 사용자 친화적 결과로. modal 패널에서 한눈에 보기 위함.
import type { MarketData } from '../model/stocks-common';
import {
  computeDonchianChannel,
  computeHHHLTrendline,
  computeKeltnerChannel,
  computeLinearRegressionChannel,
} from './channels';

export interface SRPoint {
  price: number;
  distancePct: number; // 현재가 대비 거리 % (양수=위쪽 저항, 음수=아래쪽 지지)
}

export interface ChartAnalysis {
  // 기본
  currentPrice: number;
  previousClose: number;
  changePct: number;

  // 회귀 + LR 채널
  slope: number;
  slopePctPerDay: number;
  rSquared: number;
  lrMid: number;
  lrUpper1: number;
  lrLower1: number;
  channelPositionPct: number; // 0~100, 현재가가 ±1σ 채널 내 위치
  sigmaFromMid: number; // 현재가가 mid 에서 ±N σ

  // 지지·저항
  resistances: SRPoint[];
  supports: SRPoint[];

  // 추세 상태
  trendState: 'uptrend' | 'downtrend' | 'range';
  trendReason: string;

  // 변동성
  atr: number;
  atrPct: number;

  // Donchian
  donchianUpper: number;
  donchianLower: number;

  // Keltner
  keltnerUpper: number;
  keltnerLower: number;
}

export function analyzeChart(data: MarketData[], period: number = 130): ChartAnalysis | null {
  if (data.length < 30) return null;

  const last = data[data.length - 1];
  const prev = data[data.length - 2] ?? last;
  const currentPrice = last.close;
  const previousClose = prev.close;
  const changePct = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

  // LR + 회귀 통계
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
  const sst = ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const rSquared = sst > 0 ? 1 - sse / sst : 0;
  const stdev = Math.sqrt(sse / Math.max(n - 2, 1));

  // 마지막 봉 시점의 LR 값
  const lrMid = intercept + slope * (n - 1);
  const lrUpper1 = lrMid + stdev;
  const lrLower1 = lrMid - stdev;
  const sigmaFromMid = stdev > 0 ? (currentPrice - lrMid) / stdev : 0;
  const channelWidth = lrUpper1 - lrLower1;
  const channelPositionPct =
    channelWidth > 0 ? ((currentPrice - lrLower1) / channelWidth) * 100 : 50;

  // slope%/day — close 단위가 가격이라 % 환산
  const slopePctPerDay = lrMid > 0 ? (slope / lrMid) * 100 : 0;

  // S/R — 마지막 N봉의 swing high/low 검출 후 현재가 기준 위/아래로 분류
  const window = 5;
  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];
  for (let i = window; i < tail.length; i++) {
    const rightW = Math.min(window, tail.length - 1 - i);
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + rightW; j++) {
      if (j === i) continue;
      if (tail[j].high >= tail[i].high) isHigh = false;
      if (tail[j].low <= tail[i].low) isLow = false;
    }
    if (isHigh) pivotHighs.push(tail[i].high);
    if (isLow) pivotLows.push(tail[i].low);
  }
  // 중복 제거 (같은 가격 근처는 합침 — 0.1% 이내)
  const dedupe = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
      const last = out[out.length - 1];
      if (last === undefined || Math.abs(v - last) / last > 0.001) out.push(v);
    }
    return out;
  };
  const allPivots = dedupe([...pivotHighs, ...pivotLows]);

  const resistances: SRPoint[] = allPivots
    .filter((p) => p > currentPrice)
    .slice(0, 4)
    .map((p) => ({ price: p, distancePct: ((p - currentPrice) / currentPrice) * 100 }));
  const supports: SRPoint[] = allPivots
    .filter((p) => p < currentPrice)
    .reverse()
    .slice(0, 4)
    .map((p) => ({ price: p, distancePct: ((p - currentPrice) / currentPrice) * 100 }));

  // 추세 상태 — HH/HL 단조성으로 판단
  const hhhl = computeHHHLTrendline(data, period, window);
  let trendState: 'uptrend' | 'downtrend' | 'range' = 'range';
  let trendReason = 'HH/HL 단조성 부족';
  if (hhhl.hhLine.length > 0 && hhhl.hlLine.length > 0) {
    const hhFirst = hhhl.hhLine[0].value;
    const hhLast = hhhl.hhLine[hhhl.hhLine.length - 1].value;
    const hlFirst = hhhl.hlLine[0].value;
    const hlLast = hhhl.hlLine[hhhl.hlLine.length - 1].value;
    if (hhLast > hhFirst && hlLast > hlFirst) {
      trendState = 'uptrend';
      trendReason = 'HH + HL 모두 상승 (Dow 이론 상승추세)';
    } else if (hhLast < hhFirst && hlLast < hlFirst) {
      trendState = 'downtrend';
      trendReason = 'HH + HL 모두 하락 (하락추세)';
    } else {
      trendReason = '한쪽 방향만 단조 — 횡보 / 추세 약화';
    }
  }

  // ATR (Keltner 함수 재활용 — 마지막 ATR 값 추출)
  const kel = computeKeltnerChannel(data, 20, 20, 2);
  const atr =
    kel.mid.length > 0
      ? (kel.upper[kel.upper.length - 1].value - kel.mid[kel.mid.length - 1].value) / 2
      : 0;
  const atrPct = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
  const keltnerUpper = kel.upper[kel.upper.length - 1]?.value ?? 0;
  const keltnerLower = kel.lower[kel.lower.length - 1]?.value ?? 0;

  // Donchian
  const donch = computeDonchianChannel(data, 60);
  const donchianUpper = donch.upper[donch.upper.length - 1]?.value ?? 0;
  const donchianLower = donch.lower[donch.lower.length - 1]?.value ?? 0;

  // unused (시그니처 일관성)
  void computeLinearRegressionChannel;

  return {
    currentPrice,
    previousClose,
    changePct,
    slope,
    slopePctPerDay,
    rSquared,
    lrMid,
    lrUpper1,
    lrLower1,
    channelPositionPct,
    sigmaFromMid,
    resistances,
    supports,
    trendState,
    trendReason,
    atr,
    atrPct,
    donchianUpper,
    donchianLower,
    keltnerUpper,
    keltnerLower,
  };
}
