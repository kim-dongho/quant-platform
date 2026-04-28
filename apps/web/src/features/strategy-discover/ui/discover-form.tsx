import { UNIVERSE_OPTIONS } from '@/entities/portfolio/model/factors';
import type { FactorKey } from '@/entities/portfolio/model/types';

import {
  ABSOLUTE_FACTORS,
  SELECTABLE_FACTORS,
  factorKorean,
  factorMeta,
} from '../model/factor-meta';

// 탐색 시작 폼 — 투자 대상·룰 복잡도·지표 선택·예상 소요 표시.
export const DiscoverForm = ({
  universe,
  setUniverse,
  nClauses,
  setNClauses,
  maxPositions,
  setMaxPositions,
  topN,
  setTopN,
  selectedFactors,
  toggleFactor,
  expectedSeconds,
  combos,
  onStart,
}: {
  universe: string;
  setUniverse: (v: string) => void;
  nClauses: 1 | 2;
  setNClauses: (v: 1 | 2) => void;
  maxPositions: number;
  setMaxPositions: (v: number) => void;
  topN: number;
  setTopN: (v: number) => void;
  selectedFactors: Set<FactorKey>;
  toggleFactor: (key: FactorKey) => void;
  expectedSeconds: number;
  combos: number;
  onStart: () => void;
}) => (
  <>
    <div className="border-outline-variant/30 bg-surface-container-low rounded-md border p-3 text-[11px] leading-relaxed">
      <p className="text-on-surface-variant">
        과거 10년 데이터를 <b>학습 7년 / 검증 3년</b>으로 나누어 다양한 룰 조합을 백테스트하고,{' '}
        <b>두 기간 모두에서 시장보다 잘 번 룰</b>을 위에서부터 추천합니다.
      </p>
      <p className="text-on-surface-variant mt-1.5">
        ⚠️ 과거 데이터 기반 결과이며 <b>미래 수익을 보장하지 않습니다</b>. 추천 룰을 그대로 실거래에
        쓰기 전에 본인의 판단으로 검증하세요.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-on-surface-variant text-[11px]">투자 대상</span>
        <select
          value={universe}
          onChange={(e) => setUniverse(e.target.value)}
          className="border-outline-variant/50 bg-surface focus:border-primary rounded-md border px-2 py-1.5 text-xs outline-none"
        >
          {Array.from(new Set(UNIVERSE_OPTIONS.map((u) => u.group))).map((group) => (
            <optgroup key={group ?? 'default'} label={group ?? ''}>
              {UNIVERSE_OPTIONS.filter((u) => u.group === group).map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-on-surface-variant text-[11px]">룰 복잡도</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setNClauses(1)}
            title="지표 1개로만 종목을 거름 — 빠르고 단순"
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
              nClauses === 1
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline-variant/50 bg-surface text-on-surface-variant'
            }`}
          >
            지표 1개
          </button>
          <button
            type="button"
            onClick={() => setNClauses(2)}
            title="지표 2개를 동시에 만족 (AND) — 더 정밀한 룰 발견 가능, 시간 더 오래 걸림"
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
              nClauses === 2
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline-variant/50 bg-surface text-on-surface-variant'
            }`}
          >
            지표 2개 (AND)
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-on-surface-variant text-[11px]">최대 보유 종목</span>
        <input
          type="number"
          min={1}
          max={50}
          value={maxPositions}
          onChange={(e) => setMaxPositions(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          className="border-outline-variant/50 bg-surface focus:border-primary rounded-md border px-2 py-1.5 text-xs outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-on-surface-variant text-[11px]">상위 N개</span>
        <input
          type="number"
          min={1}
          max={20}
          value={topN}
          onChange={(e) => setTopN(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          className="border-outline-variant/50 bg-surface focus:border-primary rounded-md border px-2 py-1.5 text-xs outline-none"
        />
      </label>
    </div>

    <div className="border-outline-variant/30 bg-surface-container-low flex flex-col gap-2.5 rounded-md border p-3 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-on-surface-variant">시도할 지표 선택 ({selectedFactors.size}개)</span>
        <span className="text-on-surface-variant text-[10px]">
          각 지표별로 임계값 5단계 × 비교(&gt;, &lt;) 2가지를 자동 시도
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SELECTABLE_FACTORS.map((k) => {
          const meta = factorMeta(k);
          const active = selectedFactors.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggleFactor(k)}
              title={meta?.hint}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                active
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant/40 bg-surface text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="font-mono">{meta?.label ?? k}</span>
              <span className={active ? 'opacity-90' : 'opacity-70'}>{factorKorean(k)}</span>
            </button>
          );
        })}
      </div>

      <div className="border-outline-variant/30 flex flex-wrap items-center gap-1.5 border-t pt-2">
        <span className="text-on-surface-variant mr-1 text-[10px]">선택 불가:</span>
        {ABSOLUTE_FACTORS.map((k) => {
          const meta = factorMeta(k);
          return (
            <span
              key={k}
              title="절대 가격값이라 종목 가격대마다 의미가 달라 비교가 불가능합니다 (예: 'SMA50 > 100' 은 '비싼 주식만'을 뜻함)"
              className="border-outline-variant/30 bg-surface-container text-on-surface-variant inline-flex cursor-help items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] line-through opacity-60"
            >
              <span className="font-mono">{meta?.label ?? k}</span>
            </span>
          );
        })}
        <span className="text-on-surface-variant text-[10px]">
          ← 종목간 비교 불가 (절대 가격값)
        </span>
      </div>

      <div className="text-on-surface-variant border-outline-variant/30 border-t pt-2">
        평가 조합: <b className="text-on-surface font-mono">{combos.toLocaleString()}개</b>
        {' · '}
        예상 소요:{' '}
        <b className="text-on-surface">
          {expectedSeconds < 120
            ? `약 ${expectedSeconds}초`
            : `약 ${Math.round(expectedSeconds / 60)}분`}
        </b>
        {' · '}
        학습 7년 / 검증 3년
      </div>
    </div>

    <button
      type="button"
      onClick={onStart}
      disabled={selectedFactors.size === 0}
      className="bg-primary text-on-primary mt-2 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[18px]">search</span>
      {selectedFactors.size === 0 ? '지표를 1개 이상 선택하세요' : '탐색 시작'}
    </button>
  </>
);
