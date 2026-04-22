interface Props {
  title: string;
  description: string;
  icon: string;
}

export const PlaceholderSection = ({ title, description, icon }: Props) => (
  <section className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
      <h2 className="text-[15px] font-semibold text-on-surface">{title}</h2>
    </div>
    <p className="text-sm text-on-surface-variant">{description}</p>
    <div className="mt-2 flex h-32 items-center justify-center rounded-md border border-dashed border-outline-variant/50 text-xs text-on-surface-variant">
      Coming soon
    </div>
  </section>
);
