'use client';

import { useEffect } from 'react';

import type { ChartAnalysis } from '@/entities/stock/lib/analysis';

import { formatPrice, getCurrency } from '@/shared/lib/format-price';

interface Props {
  open: boolean;
  onClose: () => void;
  analysis: ChartAnalysis | null;
  symbol: string;
  companyName: string;
}

const fmtPct = (v: number, withSign = true) => {
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

const TrendBadge = ({ state }: { state: ChartAnalysis['trendState'] }) => {
  const cfg = {
    uptrend: { label: '상승추세', cls: 'bg-green-100 text-green-700' },
    downtrend: { label: '하락추세', cls: 'bg-red-100 text-red-700' },
    range: { label: '횡보 / 약세', cls: 'bg-slate-100 text-slate-700' },
  }[state];
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
  );
};

export const AnalysisModal = ({ open, onClose, analysis, symbol, companyName }: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (!analysis) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-xl"
        >
          <div className="text-on-surface-variant text-sm">분석할 데이터가 부족합니다.</div>
        </div>
      </div>
    );
  }

  const fmt = (p: number) => formatPrice(p, symbol);
  const currency = getCurrency(symbol);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
      >
        {/* Header */}
        <div className="border-outline-variant/30 flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-on-surface text-lg font-semibold">차트 분석</h2>
            <div className="text-on-surface-variant mt-0.5 text-xs">
              {companyName} ({symbol}) · 통화 {currency}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-5 p-6">
          {/* 가격 + 추세 상태 */}
          <section>
            <SectionTitle>현재 상태</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="현재가" value={fmt(analysis.currentPrice)} />
              <Metric
                label="전일 대비"
                value={fmtPct(analysis.changePct)}
                tone={analysis.changePct >= 0 ? 'pos' : 'neg'}
              />
              <div className="flex flex-col gap-1">
                <span className="text-on-surface-variant text-[11px] font-medium">추세 상태</span>
                <div className="flex items-center gap-2">
                  <TrendBadge state={analysis.trendState} />
                </div>
                <span className="text-on-surface-variant text-[11px]">{analysis.trendReason}</span>
              </div>
            </div>
          </section>

          {/* 지지 / 저항 */}
          <section>
            <SectionTitle>지지선 · 저항선</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-on-surface-variant mb-1 text-[11px] font-medium">
                  저항 (위쪽 swing high)
                </div>
                {analysis.resistances.length > 0 ? (
                  <ul className="space-y-1">
                    {analysis.resistances.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-baseline justify-between rounded-md bg-red-50 px-2 py-1 font-mono text-xs"
                      >
                        <span className="font-semibold text-red-700">{fmt(r.price)}</span>
                        <span className="text-red-600/70">{fmtPct(r.distancePct)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-on-surface-variant text-xs">위쪽 swing 없음</div>
                )}
              </div>
              <div>
                <div className="text-on-surface-variant mb-1 text-[11px] font-medium">
                  지지 (아래쪽 swing low)
                </div>
                {analysis.supports.length > 0 ? (
                  <ul className="space-y-1">
                    {analysis.supports.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-baseline justify-between rounded-md bg-green-50 px-2 py-1 font-mono text-xs"
                      >
                        <span className="font-semibold text-green-700">{fmt(s.price)}</span>
                        <span className="text-green-600/70">{fmtPct(s.distancePct)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-on-surface-variant text-xs">아래쪽 swing 없음</div>
                )}
              </div>
            </div>
          </section>

          {/* 회귀 + LR 채널 */}
          <section>
            <SectionTitle>회귀 추세 + LR 채널</SectionTitle>
            <div className="grid grid-cols-4 gap-3">
              <Metric
                label="추세 강도 (slope)"
                value={fmtPct(analysis.slopePctPerDay)}
                tone={analysis.slopePctPerDay >= 0 ? 'pos' : 'neg'}
                hint="일별 % 변화"
              />
              <Metric
                label="R² (적합도)"
                value={analysis.rSquared.toFixed(3)}
                hint={analysis.rSquared > 0.6 ? '강한 추세' : '약한 추세'}
              />
              <Metric
                label="채널 내 위치"
                value={`${analysis.channelPositionPct.toFixed(0)}%`}
                hint={`σ from mid: ${analysis.sigmaFromMid.toFixed(2)}`}
              />
              <Metric label="LR Mid" value={fmt(analysis.lrMid)} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Metric label="LR +1σ (상단)" value={fmt(analysis.lrUpper1)} />
              <Metric label="LR -1σ (하단)" value={fmt(analysis.lrLower1)} />
            </div>
          </section>

          {/* 변동성 + 다른 채널 */}
          <section>
            <SectionTitle>변동성 · 보조 채널</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Metric
                label="ATR"
                value={fmt(analysis.atr)}
                hint={`${fmtPct(analysis.atrPct, false)} of price`}
              />
              <Metric label="Keltner Upper" value={fmt(analysis.keltnerUpper)} />
              <Metric label="Keltner Lower" value={fmt(analysis.keltnerLower)} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Metric label="Donchian Upper (60봉)" value={fmt(analysis.donchianUpper)} />
              <Metric label="Donchian Lower (60봉)" value={fmt(analysis.donchianLower)} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-on-surface mb-2 text-sm font-semibold">{children}</h3>
);

interface MetricProps {
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
  hint?: string;
}

const Metric = ({ label, value, tone, hint }: MetricProps) => {
  const valueCls =
    tone === 'pos' ? 'text-green-700' : tone === 'neg' ? 'text-red-700' : 'text-on-surface';
  return (
    <div className="border-outline-variant/30 flex flex-col gap-0.5 rounded-md border p-2.5">
      <span className="text-on-surface-variant text-[11px] font-medium">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${valueCls}`}>{value}</span>
      {hint && <span className="text-on-surface-variant text-[11px]">{hint}</span>}
    </div>
  );
};
