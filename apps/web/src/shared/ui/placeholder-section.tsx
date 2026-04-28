interface Props {
  title: string;
  description: string;
  icon: string;
}

export const PlaceholderSection = ({ title, description, icon }: Props) => (
  <section className="border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-3 rounded-xl border p-6">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
      <h2 className="text-on-surface text-[15px] font-semibold">{title}</h2>
    </div>
    <p className="text-on-surface-variant text-sm">{description}</p>
    <div className="border-outline-variant/50 text-on-surface-variant mt-2 flex h-32 items-center justify-center rounded-md border border-dashed text-xs">
      Coming soon
    </div>
  </section>
);
