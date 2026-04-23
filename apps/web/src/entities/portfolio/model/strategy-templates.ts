import type { Clause, ExitPolicy } from './types';

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  clauses: Clause[];
  max_positions: number;
  exit_policy: ExitPolicy | null;
}

/**
 * 진입 조건 + 청산 조건을 한 쌍으로 묶은 "전략 템플릿".
 * 드롭다운에서 선택하면 현재 룰 세트를 이 값으로 덮어쓴다.
 */
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'rsi_oversold',
    name: 'RSI 과매도 반등',
    description: 'RSI 30 이하 + 상승추세. 5일 후 강제 청산 (Connors 스타일)',
    icon: 'autorenew',
    clauses: [
      { factor: 'rsi_14', op: '<', value: 30 },
      { factor: 'price_vs_sma50', op: '>', value: 0 },
    ],
    max_positions: 10,
    exit_policy: {
      time_exit_days: 5,
    },
  },
  {
    id: 'balanced_trend',
    name: '균형형 추세 추종',
    description: '50일선 돌파 + 단기 모멘텀. -5% 손절 / +10% 익절 / 20일 종료',
    icon: 'trending_up',
    clauses: [
      { factor: 'price_vs_sma50', op: '>', value: 0.05 },
      { factor: 'return_5d', op: '>', value: 0.02 },
    ],
    max_positions: 10,
    exit_policy: {
      stop_loss_pct: -5,
      take_profit_pct: 10,
      time_exit_days: 20,
    },
  },
  {
    id: 'breakout',
    name: '거래량 돌파',
    description: '평균 대비 거래량 1.5배 + 추세 진입. Minervini 스타일 청산',
    icon: 'show_chart',
    clauses: [
      { factor: 'vol_ratio_20d', op: '>', value: 1.5 },
      { factor: 'price_vs_sma50', op: '>', value: 0.02 },
    ],
    max_positions: 10,
    exit_policy: {
      stop_loss_pct: -7,
      trailing_stop_pct: -15,
      time_exit_days: 60,
    },
  },
  {
    id: 'pullback',
    name: '추세 내 조정',
    description: '상승추세 내 경미한 조정 매수 (Weinstein). 보수형 청산',
    icon: 'waves',
    clauses: [
      { factor: 'rsi_14', op: '<', value: 45 },
      { factor: 'price_vs_sma50', op: '>', value: 0.02 },
    ],
    max_positions: 10,
    exit_policy: {
      stop_loss_pct: -3,
      take_profit_pct: 5,
      trailing_stop_pct: -5,
      time_exit_days: 10,
    },
  },
  {
    id: 'oneil',
    name: "O'Neil (CANSLIM) 스타일",
    description: '추세 돌파 + -7% 하드 손절 + 60일 보유',
    icon: 'rocket_launch',
    clauses: [
      { factor: 'price_vs_sma50', op: '>', value: 0.05 },
      { factor: 'vol_ratio_20d', op: '>', value: 1.2 },
    ],
    max_positions: 10,
    exit_policy: {
      stop_loss_pct: -7,
      time_exit_days: 60,
    },
  },
];

/** 현재 설정과 100% 일치하는 템플릿 찾기 (헤더에 현재 적용 중 표시용). */
export const findActiveTemplate = (
  clauses: Clause[],
  exit_policy: ExitPolicy | null,
): StrategyTemplate | null => {
  return (
    STRATEGY_TEMPLATES.find((t) => {
      if (t.clauses.length !== clauses.length) return false;
      const clausesMatch = t.clauses.every((tc) =>
        clauses.some((c) => c.factor === tc.factor && c.op === tc.op && c.value === tc.value),
      );
      if (!clausesMatch) return false;
      const tp = t.exit_policy;
      if (!tp && !exit_policy) return true;
      if (!tp || !exit_policy) return false;
      return (
        (tp.stop_loss_pct ?? null) === (exit_policy.stop_loss_pct ?? null) &&
        (tp.take_profit_pct ?? null) === (exit_policy.take_profit_pct ?? null) &&
        (tp.trailing_stop_pct ?? null) === (exit_policy.trailing_stop_pct ?? null) &&
        (tp.time_exit_days ?? null) === (exit_policy.time_exit_days ?? null)
      );
    }) ?? null
  );
};
