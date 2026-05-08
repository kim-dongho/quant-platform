'use client';

import type { FactorPortfolioConfig } from '../model/use-factor-portfolio';

interface Props {
  config: FactorPortfolioConfig;
  onChange: (next: FactorPortfolioConfig) => void;
  onReset: () => void;
}

const UNIVERSES = [
  { value: 'kospi200', label: 'KOSPI 200' },
  // 펀더멘털 데이터 미수집 — 추후 활성화
  // { value: 'krx350', label: 'KRX 350' },
];

const TOP_PCT_OPTIONS = [
  { value: 0.1, label: '상위 10%' },
  { value: 0.2, label: '상위 20%' },
  { value: 0.3, label: '상위 30%' },
];

const REBALANCE_OPTIONS = [
  { value: 1, label: '월 1회' },
  { value: 3, label: '분기 1회' },
  { value: 6, label: '반기 1회' },
  { value: 12, label: '연 1회' },
];

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-on-surface text-[11px] font-semibold">{label}</label>
    {children}
    {hint && <span className="text-on-surface-variant text-[10px]">{hint}</span>}
  </div>
);

export const FactorForm = ({ config, onChange, onReset }: Props) => {
  const update = (patch: Partial<FactorPortfolioConfig>) => onChange({ ...config, ...patch });

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-on-surface text-[15px] font-semibold">백테스트 조건</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-on-surface-variant hover:text-on-surface text-[11px]"
        >
          초기화
        </button>
      </div>

      <Field label="종목 풀">
        <select
          value={config.universe}
          onChange={(e) => update({ universe: e.target.value })}
          className="border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary rounded-lg border px-3 py-2 text-sm focus:outline-none"
        >
          {UNIVERSES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="시작일">
          <input
            type="date"
            value={config.start_date}
            onChange={(e) => update({ start_date: e.target.value })}
            className="border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary rounded-lg border px-3 py-2 text-sm focus:outline-none"
          />
        </Field>
        <Field label="종료일">
          <input
            type="date"
            value={config.end_date}
            onChange={(e) => update({ end_date: e.target.value })}
            className="border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary rounded-lg border px-3 py-2 text-sm focus:outline-none"
          />
        </Field>
      </div>

      <Field label="매수 비중" hint="종합 점수 상위 몇 % 종목을 살지">
        <select
          value={config.top_pct}
          onChange={(e) => update({ top_pct: parseFloat(e.target.value) })}
          className="border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary rounded-lg border px-3 py-2 text-sm focus:outline-none"
        >
          {TOP_PCT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="리밸런싱 주기" hint="얼마나 자주 종목을 갈아탈지">
        <select
          value={config.rebalance_months}
          onChange={(e) => update({ rebalance_months: parseInt(e.target.value, 10) })}
          className="border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary rounded-lg border px-3 py-2 text-sm focus:outline-none"
        >
          {REBALANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="border-outline-variant/30 mt-1 flex flex-col gap-2 border-t pt-3">
        <h4 className="text-on-surface text-[11px] font-semibold tracking-wider uppercase">
          사용 factor (고정)
        </h4>
        <ul className="text-on-surface-variant flex flex-col gap-1 text-[11px]">
          <li>· PBR ↓ (저평가)</li>
          <li>· PER ↓ (저평가)</li>
          <li>· ROE ↑ (수익성)</li>
          <li>· 부채비율 ↓ (안정)</li>
          <li>· 영업이익률 ↑ (수익성)</li>
          <li>· 총자산회전율 ↑ (효율)</li>
        </ul>
      </div>
    </div>
  );
};
