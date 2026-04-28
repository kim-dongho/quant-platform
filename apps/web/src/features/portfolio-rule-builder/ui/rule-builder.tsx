'use client';

import { useMemo, useState } from 'react';

import { UNIVERSE_OPTIONS } from '@/entities/portfolio/model/factors';
import {
  STRATEGY_TEMPLATES,
  findActiveTemplate,
} from '@/entities/portfolio/model/strategy-templates';
import type { Clause, ExitPolicy, FactorKey, RuleConfig } from '@/entities/portfolio/model/types';

import { EXIT_CARD_META, type ExitCardMeta } from '../model/exit-meta';
import { AddRuleMenu } from './add-rule-menu';
import { ExitCard } from './exit-card';
import { FactorCard } from './factor-card';
import { TemplateMenu } from './template-menu';

interface Props {
  config: RuleConfig;
  onChange: (config: RuleConfig) => void;
  exitPolicy: ExitPolicy | null;
  onExitPolicyChange: (p: ExitPolicy | null) => void;
  onReset?: () => void;
}

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

  const usedFactors = new Set(config.clauses.map((c) => c.factor));
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
    const defaultValue = factor === 'rsi_14' ? 30 : factor.startsWith('sma') ? 0 : 0.05;
    onChange({
      ...config,
      clauses: [...config.clauses, { factor, op: '<', value: defaultValue } as Clause],
    });
    setAddMenuOpen(false);
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

      {/* Universe + 보유 종목 수 */}
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

        {config.clauses.map((c, idx) => (
          <FactorCard
            key={`clause-${idx}`}
            clause={c}
            onChange={(patch) => updateClause(idx, patch)}
            onRemove={() => removeClause(idx)}
          />
        ))}

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
