import { STRATEGY_TEMPLATES } from '@/entities/portfolio/model/strategy-templates';

// 우상단 "템플릿" 버튼 클릭 시 뜨는 메뉴 — 미리 만들어둔 전략 일괄 적용.
export const TemplateMenu = ({
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
