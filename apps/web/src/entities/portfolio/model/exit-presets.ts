import type { ExitPolicy } from './types';

export interface ExitPreset {
  id: string;
  name: string;
  description: string;
  policy: ExitPolicy | null;
}

/**
 * 청산 프리셋 — 유명 트레이더·학파들이 실제 쓰는 규칙을 기본값으로.
 * 각 프리셋은 손절·익절·최고가 추적·기간 종료 조건의 OR 결합.
 */
export const EXIT_PRESETS: ExitPreset[] = [
  {
    id: 'none',
    name: '설정 없음',
    description: '청산 조건 없음 — 슬롯이 다 차면 더 이상 매매 없음',
    policy: null,
  },
  {
    id: 'balanced',
    name: '균형형 (기본)',
    description: '-5% 손절 / +10% 익절 / 20일 기간종료. 초심자 무난한 디폴트',
    policy: {
      stop_loss_pct: -5,
      take_profit_pct: 10,
      time_exit_days: 20,
    },
  },
  {
    id: 'conservative',
    name: '보수형',
    description: '-3% 손절 / +5% 익절 / 최고가 -5% 추적 / 10일 종료. 손실 방어 우선',
    policy: {
      stop_loss_pct: -3,
      take_profit_pct: 5,
      trailing_stop_pct: -5,
      time_exit_days: 10,
    },
  },
  {
    id: 'oneil',
    name: "O'Neil (CANSLIM)",
    description: "-7% 하드 손절 + 60일 종료. O'Neil의 고전 룰",
    policy: {
      stop_loss_pct: -7,
      time_exit_days: 60,
    },
  },
  {
    id: 'minervini',
    name: 'Minervini (SEPA)',
    description: '-7% 손절 / 최고가 -15% 추적 / 60일 종료. 추세 보존형',
    policy: {
      stop_loss_pct: -7,
      trailing_stop_pct: -15,
      time_exit_days: 60,
    },
  },
  {
    id: 'mean_reversion',
    name: '단기 반등 (Connors)',
    description: '5일 기간종료만. 손절·익절 없음 — 단기 평균회귀용',
    policy: {
      time_exit_days: 5,
    },
  },
  {
    id: 'momentum',
    name: '모멘텀 추종',
    description: '-10% 손절 / 60일 종료. 장기 추세 전략용',
    policy: {
      stop_loss_pct: -10,
      time_exit_days: 60,
    },
  },
];

export const findExitPreset = (policy: ExitPolicy | null | undefined): ExitPreset | undefined => {
  if (!policy) return EXIT_PRESETS.find((p) => p.id === 'none');
  return EXIT_PRESETS.find((p) => {
    const pp = p.policy;
    if (!pp) return false;
    return (
      pp.stop_loss_pct === policy.stop_loss_pct &&
      pp.take_profit_pct === policy.take_profit_pct &&
      pp.trailing_stop_pct === policy.trailing_stop_pct &&
      pp.time_exit_days === policy.time_exit_days
    );
  });
};
