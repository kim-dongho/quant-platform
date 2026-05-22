'use client';

import type { ChannelToggles } from '../model/dashboard-store';
import { useDashboardStore } from '../model/dashboard-store';

// 각 채널의 라벨 + tooltip 설명. 색깔은 stock-chart 의 series 와 동일하게 유지.
interface ChannelMeta {
  key: keyof ChannelToggles;
  label: string;
  swatch: string;
  description: string;
}

const CHANNELS: ChannelMeta[] = [
  {
    key: 'lrChannel',
    label: 'LR ±σ',
    swatch: '#a855f7',
    description:
      '선형회귀 추세선 ± 표준편차 (1σ/2σ/3σ). 가격이 ±1σ (68%) 안에서 자주 움직이고, 돌파 시 다음 타겟은 ±2σ (95%) → ±3σ (99.7%). 추세 + 변동 범위를 동시에 본다.',
  },
  {
    key: 'standardError',
    label: 'SE',
    swatch: '#ec4899',
    description:
      'Standard Error Channel — 회귀선 ± k×SE (σ/√n). LR ±σ 가 가격 변동 범위라면 이건 회귀선 자체의 신뢰구간. 좁을수록 추세선이 통계적으로 정확하다는 의미.',
  },
  {
    key: 'keltner',
    label: 'Keltner',
    swatch: '#0ea5e9',
    description:
      'Keltner Channel — EMA20 ± 2×ATR. σ 대신 ATR(평균 진폭) 사용해 갭이나 변동성 급증에 robust. Trend Following / CTA 표준.',
  },
  {
    key: 'pitchfork',
    label: 'Pitchfork',
    swatch: '#d97706',
    description:
      "Andrews' Pitchfork — 3개 swing point 으로 미디언선 + 평행 채널. 미디언선이 magnet 역할 (가격이 자주 회귀). 직관적 기하 채널.",
  },
  {
    key: 'hhhl',
    label: 'HH/HL',
    swatch: '#22c55e',
    description:
      'Dow 이론 추세선 — Higher Highs 만 연결한 상단 (녹색), Higher Lows 만 연결한 하단 (적색). 단조성 강제. 추세가 깨졌다 = 가장 최근 HH/HL 무너졌다.',
  },
  {
    key: 'horizontalLevels',
    label: 'S/R Level',
    swatch: '#64748b',
    description:
      '직전 swing high/low 가로 점선 — 채널 돌파 시 다음 타겟. 가격이 실제로 닿았던 가격대라 심리적 저항/지지로 작용.',
  },
  {
    key: 'donchian',
    label: 'Donchian',
    swatch: '#f97316',
    description:
      'Donchian Channel — 직전 N봉의 최고가/최저가. Turtle Trading 의 정식 룰. 단순 박스 채널.',
  },
  {
    key: 'pivotTrendline',
    label: 'Pivot',
    swatch: '#14b8a6',
    description:
      'Pivot Trendline — 최근 2 swing high / swing low 를 연결한 추세선. 단조성 강제 안 함 (HH/HL 의 약한 버전).',
  },
];

export const ChartChannelToggles = () => {
  const channels = useDashboardStore((s) => s.channels);
  const toggle = useDashboardStore((s) => s.toggleChannel);

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-1">
      {CHANNELS.map(({ key, label, swatch, description }) => {
        const active = channels[key];
        return (
          <div key={key} className="group relative">
            <button
              type="button"
              onClick={() => toggle(key)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-outline/40 bg-surface-variant/60 text-on-surface'
                  : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: active ? swatch : 'transparent',
                  border: active ? 'none' : `1px solid ${swatch}`,
                }}
              />
              {label}
            </button>
            {/* hover 시 즉시 표시되는 커스텀 tooltip — 토글 아래쪽으로 띄워 차트 영역
                안 가림. pointer-events-none 으로 hover 가로채기 방지. */}
            <div className="border-outline-variant/40 bg-surface text-on-surface pointer-events-none invisible absolute top-full left-0 z-50 mt-1 w-72 rounded-md border p-2.5 text-xs leading-relaxed opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: swatch }}
                />
                {label}
              </div>
              <div className="text-on-surface-variant">{description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
