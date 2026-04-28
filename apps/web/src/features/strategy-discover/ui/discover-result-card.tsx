'use client';

import { getFactorLabel } from '@/entities/portfolio/model/factors';
import type { DiscoveredRow } from '@/entities/portfolio/model/types';

interface Props {
  rank: number;
  row: DiscoveredRow;
  onApply: () => void;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtSignedPct = (v: number) => {
  const formatted = (v * 100).toFixed(1);
  return v >= 0 ? `+${formatted}%` : `${formatted}%`;
};

// ─────────────────────────────────────────────────────────────
// 품질 배지: train·test 모두 alpha 양수면 "양호", 하나만 양수면 "보통", 둘 다 음수면 "약함"
// ─────────────────────────────────────────────────────────────
const qualityBadge = (row: DiscoveredRow) => {
  const positives = (row.train_alpha > 0 ? 1 : 0) + (row.test_alpha > 0 ? 1 : 0);
  if (positives === 2)
    return {
      label: '양호',
      hint: '학습·검증 기간 모두에서 시장보다 더 벌었습니다',
      cls: 'bg-success-container text-on-success-container',
    };
  if (positives === 1)
    return {
      label: '보통',
      hint: '한쪽 기간에서만 시장을 이겼습니다 — 우연일 가능성을 의심해보세요',
      cls: 'bg-warning-container text-on-warning-container',
    };
  return {
    label: '약함',
    hint: '시장보다 못했습니다 — 추천하지 않습니다',
    cls: 'bg-danger-container text-on-danger-container',
  };
};

export const DiscoverResultCard = ({ rank, row, onApply }: Props) => {
  const ruleParts = row.clauses.map((c) => (
    <span
      key={`${c.factor}-${c.op}`}
      className="bg-primary-fixed/40 text-on-primary-fixed-variant inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px]"
    >
      {getFactorLabel(c.factor)} <span className="opacity-60">{c.op}</span>{' '}
      {c.value.toFixed(c.factor === 'rsi_14' ? 1 : 3)}
    </span>
  ));

  const badge = qualityBadge(row);

  return (
    <div className="border-outline-variant/40 bg-surface flex flex-col gap-3 rounded-lg border p-3 transition-shadow hover:shadow-md">
      {/* 헤더: 순위 + 품질배지 + 룰 + 적용 버튼 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-primary text-on-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
            {rank}
          </span>
          <span
            title={badge.hint}
            className={`${badge.cls} shrink-0 cursor-help rounded-md px-1.5 py-0.5 text-[10px] font-semibold`}
          >
            {badge.label}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {ruleParts.flatMap((p, i) =>
              i === 0
                ? [p]
                : [
                    <span
                      key={`and-${i}`}
                      className="text-on-surface-variant text-[10px] font-semibold"
                    >
                      AND
                    </span>,
                    p,
                  ],
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onApply}
          className="bg-primary text-on-primary shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold hover:opacity-90"
        >
          이 룰 적용
        </button>
      </div>

      {/* 메트릭 그리드 */}
      <div className="border-outline-variant/30 grid grid-cols-2 gap-3 border-t pt-3">
        <MetricColumn
          label="학습 기간 (과거 데이터로 룰을 골라냄)"
          shortLabel="학습 기간"
          row={row}
          prefix="train"
        />
        <MetricColumn
          label="검증 기간 (룰이 처음 보는 데이터)"
          shortLabel="검증 기간"
          row={row}
          prefix="test"
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 메트릭 한 컬럼 — 한글 라벨 + 툴팁
// ─────────────────────────────────────────────────────────────
const MetricColumn = ({
  label,
  shortLabel,
  row,
  prefix,
}: {
  label: string;
  shortLabel: string;
  row: DiscoveredRow;
  prefix: 'train' | 'test';
}) => {
  const sharpe = row[`${prefix}_sharpe` as const];
  const cagr = row[`${prefix}_cagr` as const];
  const alpha = row[`${prefix}_alpha` as const];
  const excess = row[`${prefix}_excess_cagr` as const];
  const mdd = row[`${prefix}_mdd` as const];
  const trades = row[`${prefix}_trades` as const];
  const winRate = row[`${prefix}_win_rate` as const];

  return (
    <div className="flex flex-col gap-1.5">
      <div
        title={label}
        className="text-on-surface-variant cursor-help text-[10px] font-semibold tracking-wide uppercase"
      >
        {shortLabel}
      </div>
      <div className="flex flex-col gap-0.5 font-mono text-[11px] tabular-nums">
        <KV
          k="시장 초과수익 α"
          tip="벤치마크 ETF를 베타만큼 따라가고 남은 진짜 실력. >0 이어야 의미있음"
          v={fmtSignedPct(alpha)}
          highlight={alpha > 0}
          warn={alpha <= 0}
        />
        <KV k="연평균 수익률" tip="기간 동안의 연환산 복리 수익률 (CAGR)" v={fmtSignedPct(cagr)} />
        <KV
          k="시장 대비 초과 CAGR"
          tip="이 룰의 연수익률 − 벤치마크 연수익률"
          v={fmtSignedPct(excess)}
          highlight={excess > 0}
        />
        <KV
          k="위험조정 수익 (Sharpe)"
          tip="수익을 변동성으로 나눈 값. >1 양호, >2 우수"
          v={sharpe.toFixed(2)}
        />
        <KV
          k="최대 낙폭 (MDD)"
          tip="기간 중 가장 깊었던 평가손실. -20% = 자산이 한때 20% 빠졌었음"
          v={fmtSignedPct(mdd)}
        />
        <KV k="총 거래" tip="진입·청산 완료된 매매 횟수" v={`${trades}회`} />
        <KV k="승률" tip="이익 거래 비율 (≠ 수익률)" v={fmtPct(winRate)} />
      </div>
    </div>
  );
};

const KV = ({
  k,
  tip,
  v,
  highlight,
  warn,
}: {
  k: string;
  tip: string;
  v: string;
  highlight?: boolean;
  warn?: boolean;
}) => (
  <div className="flex justify-between gap-1">
    <span title={tip} className="text-on-surface-variant cursor-help">
      {k}
    </span>
    <span
      className={highlight ? 'text-primary font-semibold' : warn ? 'text-error' : 'text-on-surface'}
    >
      {v}
    </span>
  </div>
);
