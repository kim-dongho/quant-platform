'use client';

import { useMemo, useState } from 'react';

import { FACTOR_OPTIONS, OPS, UNIVERSE_OPTIONS } from '@/entities/portfolio/model/factors';
import {
  STRATEGY_TEMPLATES,
  findActiveTemplate,
} from '@/entities/portfolio/model/strategy-templates';
import type {
  Clause,
  ExitPolicy,
  FactorKey,
  FactorOp,
  RuleConfig,
} from '@/entities/portfolio/model/types';

interface Props {
  config: RuleConfig;
  onChange: (config: RuleConfig) => void;
  exitPolicy: ExitPolicy | null;
  onExitPolicyChange: (p: ExitPolicy | null) => void;
  onReset?: () => void;
}

type ExitKey = 'stop_loss' | 'take_profit' | 'trailing_stop' | 'time_exit';

interface ExitCardMeta {
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

const EXIT_CARD_META: ExitCardMeta[] = [
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

export const RuleBuilder = ({
  config,
  onChange,
  exitPolicy,
  onExitPolicyChange,
  onReset,
}: Props) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  const activeTemplate = useMemo(
    () => findActiveTemplate(config.clauses, exitPolicy),
    [config.clauses, exitPolicy],
  );

  // 현재 사용된 진입 팩터 set (중복 방지)
  const usedFactors = new Set(config.clauses.map((c) => c.factor));
  // 현재 켜져있는 exit 종류 set
  const activeExits = new Set(
    EXIT_CARD_META.filter((m) => (exitPolicy?.[m.field] ?? null) !== null).map((m) => m.key),
  );

  const applyTemplate = (tplId: string) => {
    const tpl = STRATEGY_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    onChange({
      ...config,
      clauses: tpl.clauses.map((c) => ({ ...c })),
      max_positions: tpl.max_positions,
    });
    onExitPolicyChange(tpl.exit_policy ? { ...tpl.exit_policy } : null);
    setTemplateMenuOpen(false);
  };

  const updateClause = (idx: number, patch: Partial<Clause>) => {
    const next = config.clauses.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...config, clauses: next });
  };
  const removeClause = (idx: number) => {
    onChange({ ...config, clauses: config.clauses.filter((_, i) => i !== idx) });
  };

  const addFactorClause = (factor: FactorKey) => {
    const step = FACTOR_OPTIONS.find((f) => f.key === factor)?.step ?? 0.1;
    const defaultValue = factor === 'rsi_14' ? 30 : factor.startsWith('sma') ? 0 : 0.05;
    onChange({
      ...config,
      clauses: [...config.clauses, { factor, op: '<', value: defaultValue } as Clause],
    });
    setAddMenuOpen(false);
    void step;
  };

  const updateExit = (field: keyof ExitPolicy, value: number | null) => {
    const next: ExitPolicy = { ...(exitPolicy ?? {}) };
    if (value === null) {
      delete next[field];
    } else {
      (next as Record<string, number>)[field as string] = value;
    }
    const hasAny =
      next.stop_loss_pct != null ||
      next.take_profit_pct != null ||
      next.trailing_stop_pct != null ||
      next.time_exit_days != null ||
      (next.signal_exit_clauses && next.signal_exit_clauses.length > 0);
    onExitPolicyChange(hasAny ? next : null);
  };

  const addExitCard = (meta: ExitCardMeta) => {
    updateExit(meta.field, meta.defaultValue);
    setAddMenuOpen(false);
  };

  return (
    <div className="border-outline-variant/30 bg-surface-container-lowest flex min-h-0 flex-1 flex-col gap-3 rounded-xl border p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-on-surface text-[15px] font-semibold">전략 규칙</h2>
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setTemplateMenuOpen((v) => !v);
              setAddMenuOpen(false);
            }}
            className="border-outline-variant/50 bg-surface text-on-surface hover:bg-surface-container-low flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
            title="미리 만들어둔 전략 템플릿 불러오기"
          >
            <span className="material-symbols-outlined text-[14px]">bookmarks</span>
            템플릿
          </button>
          <button
            type="button"
            onClick={() => {
              setAddMenuOpen((v) => !v);
              setTemplateMenuOpen(false);
            }}
            className="bg-primary text-on-primary flex h-7 w-7 items-center justify-center rounded-full shadow-sm hover:opacity-90"
            aria-label="조건 추가"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          {templateMenuOpen && (
            <TemplateMenu
              onSelect={applyTemplate}
              onClose={() => setTemplateMenuOpen(false)}
              activeId={activeTemplate?.id}
            />
          )}
          {addMenuOpen && (
            <AddRuleMenu
              usedFactors={usedFactors}
              activeExits={activeExits}
              onAddFactor={addFactorClause}
              onAddExit={addExitCard}
              onClose={() => setAddMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Universe + 보유 종목 수 — 좁은 컬럼을 위해 두 줄로 */}
      <div className="border-outline-variant/30 flex flex-col gap-2 border-b pb-3">
        <label className="flex items-center justify-between gap-2">
          <span className="text-on-surface-variant shrink-0 text-[11px]">투자 대상</span>
          <select
            value={config.universe}
            onChange={(e) => onChange({ ...config, universe: e.target.value })}
            className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary min-w-0 flex-1 rounded-md border px-2 py-1 text-xs outline-none focus:ring-1"
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
        <label className="flex items-center justify-between gap-2">
          <span className="text-on-surface-variant shrink-0 text-[11px]">최대 보유 종목</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={50}
              value={config.max_positions}
              onChange={(e) =>
                onChange({
                  ...config,
                  max_positions: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                })
              }
              className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-16 rounded-md border px-1.5 py-1 text-right font-mono text-xs tabular-nums outline-none focus:ring-1"
            />
            <span className="text-on-surface-variant text-[11px]">종목</span>
          </div>
        </label>
      </div>

      {/* 카드 리스트 */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {config.clauses.length === 0 && activeExits.size === 0 && (
          <p className="border-outline-variant/40 text-on-surface-variant rounded-md border border-dashed px-3 py-6 text-center text-xs">
            조건이 없습니다 — 상단의 <b>템플릿</b>을 불러오거나 <b>+</b> 버튼으로
            <br />
            개별 조건을 추가해보세요
          </p>
        )}

        {/* 진입 팩터 카드들 */}
        {config.clauses.map((c, idx) => (
          <FactorCard
            key={`clause-${idx}`}
            clause={c}
            onChange={(patch) => updateClause(idx, patch)}
            onRemove={() => removeClause(idx)}
          />
        ))}

        {/* Exit 카드들 */}
        {EXIT_CARD_META.map((meta) => {
          const value = exitPolicy?.[meta.field] as number | null | undefined;
          if (value == null) return null;
          return (
            <ExitCard
              key={meta.key}
              meta={meta}
              value={value}
              onChange={(v) => updateExit(meta.field, v)}
              onRemove={() => updateExit(meta.field, null)}
            />
          );
        })}
      </div>

      {onReset && (config.clauses.length > 0 || activeExits.size > 0) && (
        <button
          type="button"
          onClick={onReset}
          className="text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface mt-auto flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px]"
        >
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
          기본값으로 초기화
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 카드 컴포넌트 — 진입 팩터
// ─────────────────────────────────────────────────────────────
const FactorCard = ({
  clause,
  onChange,
  onRemove,
}: {
  clause: Clause;
  onChange: (patch: Partial<Clause>) => void;
  onRemove: () => void;
}) => {
  const opt = FACTOR_OPTIONS.find((f) => f.key === clause.factor);
  return (
    <RuleCardShell
      icon="show_chart"
      title={opt?.label ?? clause.factor}
      subtitle={opt?.hint ?? '진입 조건'}
      onRemove={onRemove}
    >
      <div className="flex items-center gap-1.5">
        <select
          value={clause.factor}
          onChange={(e) => onChange({ factor: e.target.value as FactorKey })}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary min-w-0 flex-1 rounded-md border px-2 py-1 font-mono text-xs outline-none focus:ring-1"
        >
          {FACTOR_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={clause.op}
          onChange={(e) => onChange({ op: e.target.value as FactorOp })}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-12 shrink-0 rounded-md border px-1 py-1 text-center font-mono text-xs outline-none focus:ring-1"
        >
          {OPS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={clause.value}
          step={opt?.step ?? 0.1}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-20 shrink-0 rounded-md border px-1.5 py-1 text-right font-mono text-xs tabular-nums outline-none focus:ring-1"
        />
      </div>
    </RuleCardShell>
  );
};

// ─────────────────────────────────────────────────────────────
// 카드 컴포넌트 — 청산 조건 (공용)
// ─────────────────────────────────────────────────────────────
const ExitCard = ({
  meta,
  value,
  onChange,
  onRemove,
}: {
  meta: ExitCardMeta;
  value: number;
  onChange: (v: number) => void;
  onRemove: () => void;
}) => {
  return (
    <RuleCardShell icon={meta.icon} title={meta.label} subtitle={meta.hint} onRemove={onRemove}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          step={meta.step}
          min={meta.min}
          max={meta.max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="border-outline-variant/50 bg-surface focus:border-primary focus:ring-primary w-24 rounded-md border px-2 py-1 text-right font-mono text-sm tabular-nums outline-none focus:ring-1"
        />
        <span className="text-on-surface-variant text-xs">{meta.unit}</span>
      </div>
    </RuleCardShell>
  );
};

// ─────────────────────────────────────────────────────────────
// 공용 카드 껍데기
// ─────────────────────────────────────────────────────────────
const RuleCardShell = ({
  icon,
  title,
  subtitle,
  onRemove,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onRemove: () => void;
  children: React.ReactNode;
}) => (
  <div className="border-outline-variant/30 bg-surface flex flex-col gap-2 rounded-lg border p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-primary mt-0.5 shrink-0 text-[18px]">
          {icon}
        </span>
        <div className="flex flex-col">
          <span className="text-on-surface text-[13px] font-semibold">{title}</span>
          {subtitle && (
            <span className="text-on-surface-variant text-[10px] leading-snug">{subtitle}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="삭제"
        className="text-on-surface-variant hover:bg-error-container hover:text-error flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────
// 조건 추가 메뉴
// ─────────────────────────────────────────────────────────────
const AddRuleMenu = ({
  usedFactors,
  activeExits,
  onAddFactor,
  onAddExit,
  onClose,
}: {
  usedFactors: Set<string>;
  activeExits: Set<ExitKey>;
  onAddFactor: (factor: FactorKey) => void;
  onAddExit: (meta: ExitCardMeta) => void;
  onClose: () => void;
}) => (
  <>
    <div className="fixed inset-0 z-30" onClick={onClose} />
    <div className="border-outline-variant/50 bg-surface-container-lowest absolute top-full right-0 z-40 mt-1 flex max-h-[70vh] w-64 flex-col overflow-y-auto rounded-lg border shadow-lg">
      <div className="border-outline-variant/30 bg-surface-container-low text-on-surface-variant sticky top-0 border-b px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
        매수 조건 (진입 팩터)
      </div>
      {FACTOR_OPTIONS.map((f) => {
        const disabled = usedFactors.has(f.key);
        return (
          <button
            key={f.key}
            type="button"
            disabled={disabled}
            onClick={() => onAddFactor(f.key)}
            className="hover:bg-surface-container-low flex w-full flex-col items-start px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-on-surface text-xs font-semibold">{f.label}</span>
            {f.hint && <span className="text-on-surface-variant text-[10px]">{f.hint}</span>}
          </button>
        );
      })}

      <div className="border-outline-variant/30 bg-surface-container-low text-on-surface-variant border-y px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
        매도 조건
      </div>
      {EXIT_CARD_META.map((m) => {
        const disabled = activeExits.has(m.key);
        return (
          <button
            key={m.key}
            type="button"
            disabled={disabled}
            onClick={() => onAddExit(m)}
            className="hover:bg-surface-container-low flex w-full items-start gap-2 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-primary mt-0.5 text-[16px]">
              {m.icon}
            </span>
            <div className="flex flex-col">
              <span className="text-on-surface text-xs font-semibold">{m.label}</span>
              <span className="text-on-surface-variant text-[10px]">{m.hint}</span>
            </div>
          </button>
        );
      })}
    </div>
  </>
);

// ─────────────────────────────────────────────────────────────
// 템플릿 메뉴
// ─────────────────────────────────────────────────────────────
const TemplateMenu = ({
  onSelect,
  onClose,
  activeId,
}: {
  onSelect: (id: string) => void;
  onClose: () => void;
  activeId?: string;
}) => (
  <>
    <div className="fixed inset-0 z-30" onClick={onClose} />
    <div className="border-outline-variant/50 bg-surface-container-lowest absolute top-full right-0 z-40 mt-1 flex max-h-[70vh] w-72 flex-col overflow-y-auto rounded-lg border shadow-lg">
      <div className="border-outline-variant/30 bg-surface-container-low text-on-surface-variant sticky top-0 border-b px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
        전략 템플릿 — 선택 시 현재 조건을 덮어씁니다
      </div>
      {STRATEGY_TEMPLATES.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`hover:bg-surface-container-low flex w-full items-start gap-2 px-3 py-2 text-left ${
              active ? 'bg-primary-fixed/30' : ''
            }`}
          >
            <span className="material-symbols-outlined text-primary mt-0.5 shrink-0 text-[18px]">
              {t.icon}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-on-surface text-xs font-semibold">{t.name}</span>
              <span className="text-on-surface-variant text-[10px] leading-snug">
                {t.description}
              </span>
            </div>
            {active && (
              <span className="material-symbols-outlined text-primary ml-auto text-[16px]">
                check
              </span>
            )}
          </button>
        );
      })}
    </div>
  </>
);
