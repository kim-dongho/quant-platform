'use client';

import { useState } from 'react';

import { useDiscoverJobStatus, useStartDiscover } from '@/entities/portfolio/api/portfolio-queries';
import { FACTOR_OPTIONS, UNIVERSE_OPTIONS } from '@/entities/portfolio/model/factors';
import type {
  Clause,
  DiscoverJobState,
  DiscoverResult,
  ExitPolicy,
  FactorKey,
  RuleConfig,
} from '@/entities/portfolio/model/types';

import { DiscoverResultCard } from './discover-result-card';

// ─────────────────────────────────────────────────────────────
// 자동 탐색에서 사용 가능한 factor — 종목간 비교가 가능한 정규화 지표만.
//
// 절대값 SMA(20/50/200) 는 종목 가격대에 의존(예: 사과 $180 vs 코카콜라 $60)하므로
// "SMA50 > 100" 같은 조건은 의미가 없어 자동 탐색 풀에서 제외한다.
// ─────────────────────────────────────────────────────────────
const SELECTABLE_FACTORS: FactorKey[] = [
  'rsi_14',
  'vol_ratio_20d',
  'return_5d',
  'price_vs_sma20',
  'price_vs_sma50',
  'price_vs_sma200',
  'sma20_vs_sma50',
];
const ABSOLUTE_FACTORS: FactorKey[] = ['sma_20', 'sma_50', 'sma_200'];
const DEFAULT_SELECTED: FactorKey[] = ['rsi_14', 'vol_ratio_20d', 'return_5d', 'price_vs_sma50'];

const N_OPS = 2; // <, >
const N_PERCENTILES = 5; // 10/30/50/70/90

const calcCombinations = (factorCount: number, n: 1 | 2): number => {
  if (factorCount === 0) return 0;
  const singles = factorCount * N_OPS * N_PERCENTILES;
  if (n === 1) return singles;
  // 2-clause: 다른 factor끼리만 (같은 factor 조합 제외)
  const perFactor = N_OPS * N_PERCENTILES;
  const sameFactorPairs = (factorCount * (perFactor * (perFactor - 1))) / 2;
  const allPairs = (singles * (singles - 1)) / 2;
  return allPairs - sameFactorPairs;
};

const factorMeta = (key: FactorKey) => FACTOR_OPTIONS.find((f) => f.key === key);

// factor의 친숙한 한글 한줄 설명 (UI 칩용)
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
const factorKorean = (key: FactorKey) => FACTOR_KOREAN[key] ?? '';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 탐색 시 기본값으로 채울 universe / max_positions */
  defaults: Pick<RuleConfig, 'universe' | 'max_positions'>;
  exitPolicy: ExitPolicy | null;
  /** 결과 카드의 "이 룰 적용" 클릭 시 호출 */
  onApply: (clauses: Clause[]) => void;
}

export const DiscoverDialog = ({ open, onClose, defaults, exitPolicy, onApply }: Props) => {
  const [universe, setUniverse] = useState(defaults.universe);
  const [nClauses, setNClauses] = useState<1 | 2>(1);
  const [maxPositions, setMaxPositions] = useState(defaults.max_positions);
  const [topN, setTopN] = useState(5);
  const [selectedFactors, setSelectedFactors] = useState<Set<FactorKey>>(new Set(DEFAULT_SELECTED));
  const [jobId, setJobId] = useState<string | null>(null);

  const startMutation = useStartDiscover();
  const statusQuery = useDiscoverJobStatus(jobId);
  const job: DiscoverJobState | undefined = statusQuery.data;

  if (!open) return null;

  const toggleFactor = (key: FactorKey) => {
    setSelectedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const start = async () => {
    const r = await startMutation.mutateAsync({
      universe,
      factors: Array.from(selectedFactors),
      n_clauses: nClauses,
      top_n: topN,
      max_positions: maxPositions,
      exit_policy: exitPolicy,
    });
    setJobId(r.job_id);
  };

  const reset = () => {
    setJobId(null);
    startMutation.reset();
  };

  const factorCount = selectedFactors.size;
  const combos = calcCombinations(factorCount, nClauses);
  // 1조합 ~150ms (1-clause), 2-clause는 같은 단위 시간이지만 조합 더 많음
  const expectedSeconds = Math.max(15, Math.round((combos * 0.15 * 2) / 1)); // train+test

  const isRunning = !!jobId && (!job || job.status === 'running');
  const result = job?.status === 'done' ? job.result : undefined;
  const errorMsg =
    startMutation.error?.message ?? (job?.status === 'error' ? job.error : undefined) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-container-lowest border-outline-variant/40 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border shadow-2xl">
        {/* 헤더 */}
        <div className="border-outline-variant/30 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">search</span>
            <h2 className="text-on-surface text-[15px] font-semibold">전략 자동 탐색</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container-low h-7 w-7 rounded-md"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {!jobId && !startMutation.isPending && (
            <DiscoverForm
              universe={universe}
              setUniverse={setUniverse}
              nClauses={nClauses}
              setNClauses={setNClauses}
              maxPositions={maxPositions}
              setMaxPositions={setMaxPositions}
              topN={topN}
              setTopN={setTopN}
              selectedFactors={selectedFactors}
              toggleFactor={toggleFactor}
              expectedSeconds={expectedSeconds}
              combos={combos}
              onStart={start}
            />
          )}

          {(startMutation.isPending || isRunning) && (
            <DiscoverProgress
              done={job?.done ?? 0}
              total={job?.total ?? combos}
              current={job?.current ?? '준비 중…'}
              startedAt={job?.started_at}
              expectedSeconds={expectedSeconds}
            />
          )}

          {errorMsg && (
            <div className="border-error/30 bg-error-container/30 text-error rounded-md border px-3 py-2 text-xs">
              탐색 실패: {errorMsg}
              <button type="button" onClick={reset} className="text-primary ml-2 underline">
                다시 시도
              </button>
            </div>
          )}

          {result && (
            <DiscoverResults
              result={result}
              onApply={(clauses) => {
                onApply(clauses);
                onClose();
              }}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 시작 폼
// ─────────────────────────────────────────────────────────────
const DiscoverForm = ({
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

      {/* 정규화 지표 (선택 가능) */}
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

      {/* 절대값 SMA — 선택 불가 (이유 표시) */}
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

      {/* 요약 */}
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

// ─────────────────────────────────────────────────────────────
// 결과 영역
// ─────────────────────────────────────────────────────────────
const DiscoverResults = ({
  result,
  onApply,
  onReset,
}: {
  result: DiscoverResult;
  onApply: (clauses: Clause[]) => void;
  onReset: () => void;
}) => (
  <>
    <div className="border-outline-variant/30 bg-surface-container-low flex items-center justify-between rounded-md border px-3 py-2">
      <div className="text-on-surface-variant text-[11px]">
        평가 {result.evaluated} · 제외 {result.skipped} · 학습 기간{' '}
        {result.params.train_period.join(' ~ ')} · 검증 기간 {result.params.test_period.join(' ~ ')}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="text-primary hover:bg-surface-container hover:text-on-primary-fixed-variant rounded-md px-2 py-1 text-[11px]"
      >
        다시 탐색
      </button>
    </div>

    {result.top.length === 0 ? (
      <div className="border-outline-variant/40 text-on-surface-variant rounded-md border border-dashed py-10 text-center text-xs">
        평가 가능한 룰이 없습니다 — 다른 투자 대상이나 조건 개수를 바꿔서 다시 시도해보세요.
      </div>
    ) : (
      <>
        <div className="border-outline-variant/30 bg-surface-container-low text-on-surface-variant flex flex-col gap-1.5 rounded-md border px-3 py-2 text-[11px] leading-relaxed">
          <div>
            <span className="font-semibold">정렬 기준:</span>{' '}
            <span title="학습 기간 α와 검증 기간 α를 더해 2로 나눈 값. 한쪽만 좋은 룰(우연·과적합 의심)을 걸러내기 위함">
              <b className="text-on-surface">학습·검증 α 평균</b>의 내림차순으로 순위를 산정합니다
            </span>{' '}
            <span className="cursor-help">ⓘ</span>
          </div>
          <div className="border-outline-variant/30 border-t pt-1.5">
            <span className="font-semibold">품질 배지:</span>{' '}
            <span className="bg-success-container text-on-success-container ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              양호
            </span>{' '}
            학습·검증 모두 시장 초과 ·{' '}
            <span className="bg-warning-container text-on-warning-container ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              보통
            </span>{' '}
            한쪽만 시장 초과 ·{' '}
            <span className="bg-danger-container text-on-danger-container ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
              약함
            </span>{' '}
            시장보다 못함
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {result.top.map((row, i) => (
            <DiscoverResultCard
              key={i}
              rank={i + 1}
              row={row}
              onApply={() => onApply(row.clauses)}
            />
          ))}
        </div>
      </>
    )}
  </>
);

// ─────────────────────────────────────────────────────────────
// 진행률 표시 (실시간 progress bar)
// ─────────────────────────────────────────────────────────────
const DiscoverProgress = ({
  done,
  total,
  current,
  startedAt,
  expectedSeconds,
}: {
  done: number;
  total: number;
  current: string;
  startedAt?: number;
  expectedSeconds: number;
}) => {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const elapsedSec = startedAt ? Math.max(0, Math.round(Date.now() / 1000 - startedAt)) : 0;
  const etaSec =
    done > 0 && elapsedSec > 0
      ? Math.max(0, Math.round((elapsedSec / done) * (total - done)))
      : Math.max(0, expectedSeconds - elapsedSec);

  return (
    <div className="flex flex-col gap-3 py-6">
      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-on-surface font-semibold">탐색 진행 중</span>
          <span className="text-on-surface-variant font-mono tabular-nums">
            {done}/{total} ({pct.toFixed(1)}%)
          </span>
        </div>
        <div className="bg-surface-container-low h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 현재 평가중인 룰 */}
      <div className="border-outline-variant/30 bg-surface-container-low flex items-center gap-2 rounded-md border px-3 py-2 text-[11px]">
        <span className="material-symbols-outlined text-on-surface-variant text-[14px]">
          {pct < 100 ? 'pending' : 'check'}
        </span>
        <span className="text-on-surface-variant shrink-0">현재 평가:</span>
        <span className="text-on-surface min-w-0 truncate font-mono">{current || '준비 중…'}</span>
      </div>

      {/* 시간 정보 */}
      <div className="text-on-surface-variant flex justify-between text-[11px]">
        <span>
          경과: <b className="text-on-surface font-mono tabular-nums">{fmtSeconds(elapsedSec)}</b>
        </span>
        <span>
          남은 예상: <b className="text-on-surface font-mono tabular-nums">{fmtSeconds(etaSec)}</b>
        </span>
      </div>
    </div>
  );
};

const fmtSeconds = (s: number): string => {
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}분 ${sec}초`;
};
