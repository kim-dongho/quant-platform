import { FACTOR_OPTIONS } from '@/entities/portfolio/model/factors';
import type { FactorKey } from '@/entities/portfolio/model/types';

import { EXIT_CARD_META, type ExitCardMeta, type ExitKey } from '../model/exit-meta';

// 우상단 + 버튼 클릭 시 뜨는 메뉴 — 매수 조건(팩터)·매도 조건 추가.
export const AddRuleMenu = ({
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
