import { FACTOR_OPTIONS } from '@/entities/portfolio/model/factors';
import type { FactorKey } from '@/entities/portfolio/model/types';

// 자동 탐색에서 사용 가능한 factor — 종목간 비교가 가능한 정규화 지표만.
// 절대값 SMA(20/50/200) 는 종목 가격대에 의존(예: 사과 $180 vs 코카콜라 $60)하므로
// "SMA50 > 100" 같은 조건은 의미가 없어 자동 탐색 풀에서 제외한다.
export const SELECTABLE_FACTORS: FactorKey[] = [
  'rsi_14',
  'vol_ratio_20d',
  'return_5d',
  'price_vs_sma20',
  'price_vs_sma50',
  'price_vs_sma200',
  'sma20_vs_sma50',
];
export const ABSOLUTE_FACTORS: FactorKey[] = ['sma_20', 'sma_50', 'sma_200'];
export const DEFAULT_SELECTED: FactorKey[] = [
  'rsi_14',
  'vol_ratio_20d',
  'return_5d',
  'price_vs_sma50',
];

export const factorMeta = (key: FactorKey) => FACTOR_OPTIONS.find((f) => f.key === key);

// factor의 친숙한 한글 한줄 설명 (UI 칩용).
const FACTOR_KOREAN: Record<string, string> = {
  rsi_14: '과열·과매도',
  vol_ratio_20d: '거래량 폭증',
  return_5d: '최근 5일 수익률',
  price_vs_sma20: '단기 추세 (20일선 대비)',
  price_vs_sma50: '중기 추세 (50일선 대비)',
  price_vs_sma200: '장기 추세 (200일선 대비)',
  sma20_vs_sma50: '골든·데드크로스 강도',
  sma_20: '20일 이동평균',
  sma_50: '50일 이동평균',
  sma_200: '200일 이동평균',
};

export const factorKorean = (key: FactorKey) => FACTOR_KOREAN[key] ?? '';
