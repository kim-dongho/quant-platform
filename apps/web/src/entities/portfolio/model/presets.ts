import type { RuleConfig } from './types';

export interface PortfolioPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: Pick<RuleConfig, 'clauses' | 'max_positions'>;
}

/**
 * 널리 쓰이는 고전 퀀트 스크리닝 전략.
 * universe는 유지하고 clauses + max_positions만 덮어씀.
 */
export const PORTFOLIO_PRESETS: PortfolioPreset[] = [
  {
    id: 'momentum',
    name: 'Momentum',
    description: '추세 추종 (Jegadeesh-Titman) — SMA50 위 + 단기 모멘텀',
    icon: 'trending_up',
    config: {
      clauses: [
        { factor: 'price_vs_sma50', op: '>', value: 0.05 },
        { factor: 'return_5d', op: '>', value: 0.02 },
      ],
      max_positions: 10,
    },
  },
  {
    id: 'mean_reversion',
    name: 'Mean Reversion',
    description: '상승추세 내 과매도 반등 (Connors RSI) — RSI < 30',
    icon: 'autorenew',
    config: {
      clauses: [
        { factor: 'rsi_14', op: '<', value: 30 },
        { factor: 'price_vs_sma50', op: '>', value: 0 },
      ],
      max_positions: 10,
    },
  },
  {
    id: 'breakout',
    name: 'Breakout',
    description: '거래량 브레이크아웃 (Darvas Box) — Vol 1.5배 + 추세',
    icon: 'show_chart',
    config: {
      clauses: [
        { factor: 'vol_ratio_20d', op: '>', value: 1.5 },
        { factor: 'price_vs_sma50', op: '>', value: 0.02 },
      ],
      max_positions: 10,
    },
  },
  {
    id: 'trend_pullback',
    name: 'Trend Pullback',
    description: '상승추세 내 경미한 조정 매수 (Weinstein Stage 2)',
    icon: 'waves',
    config: {
      clauses: [
        { factor: 'rsi_14', op: '<', value: 45 },
        { factor: 'price_vs_sma50', op: '>', value: 0.02 },
      ],
      max_positions: 10,
    },
  },
];

const clausesMatch = (preset: PortfolioPreset, config: RuleConfig): boolean => {
  const pc = preset.config.clauses;
  if (pc.length !== config.clauses.length) return false;
  return pc.every((p) =>
    config.clauses.some(
      (c) => c.factor === p.factor && c.op === p.op && c.value === p.value,
    ),
  );
};

export const findActivePreset = (config: RuleConfig): PortfolioPreset | null =>
  PORTFOLIO_PRESETS.find((p) => clausesMatch(p, config)) ?? null;
