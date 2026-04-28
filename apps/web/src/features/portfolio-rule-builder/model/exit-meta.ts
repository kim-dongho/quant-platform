import type { ExitPolicy } from '@/entities/portfolio/model/types';

export type ExitKey = 'stop_loss' | 'take_profit' | 'trailing_stop' | 'time_exit';

export interface ExitCardMeta {
  key: ExitKey;
  field: keyof ExitPolicy;
  label: string;
  icon: string;
  unit: string;
  defaultValue: number;
  step: number;
  min: number;
  max: number;
  sign: 'negative' | 'positive' | 'positive_int';
  hint: string;
}

export const EXIT_CARD_META: ExitCardMeta[] = [
  {
    key: 'stop_loss',
    field: 'stop_loss_pct',
    label: '손절 (Stop Loss)',
    icon: 'south_east',
    unit: '%',
    defaultValue: -5,
    step: 0.5,
    min: -30,
    max: 0,
    sign: 'negative',
    hint: '진입가 대비 이 % 이상 떨어지면 즉시 매도',
  },
  {
    key: 'take_profit',
    field: 'take_profit_pct',
    label: '익절 (Take Profit)',
    icon: 'north_east',
    unit: '%',
    defaultValue: 10,
    step: 0.5,
    min: 0,
    max: 100,
    sign: 'positive',
    hint: '진입가 대비 이 % 이상 오르면 즉시 매도',
  },
  {
    key: 'trailing_stop',
    field: 'trailing_stop_pct',
    label: '추적 손절 (Trailing Stop)',
    icon: 'trending_down',
    unit: '%',
    defaultValue: -8,
    step: 0.5,
    min: -30,
    max: 0,
    sign: 'negative',
    hint: '보유 중 최고가 대비 이 % 이상 떨어지면 매도',
  },
  {
    key: 'time_exit',
    field: 'time_exit_days',
    label: '보유 기간 (Time Exit)',
    icon: 'schedule',
    unit: '일',
    defaultValue: 20,
    step: 1,
    min: 1,
    max: 365,
    sign: 'positive_int',
    hint: '진입 후 이 기간 지나면 종가 청산',
  },
];
