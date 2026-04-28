// 진입/청산 카드 공용 껍데기 — 아이콘 + 제목/부제 + 삭제 버튼 + 본문 슬롯.
export const RuleCardShell = ({
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
