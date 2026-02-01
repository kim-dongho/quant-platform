import { ChartOptions } from '@/entities/stock/model/stocks-common';

interface Props {
  options: ChartOptions;
  onChange: (key: keyof ChartOptions) => void;
}

export const IndicatorSelector = ({ options, onChange }: Props) => {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-4 shadow-2xl">
      <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
        Visual Indicators
      </span>
      <div className="flex flex-wrap gap-4">
        {Object.entries(options).map(([key, value]) => (
          <label
            key={key}
            className="group flex cursor-pointer items-center gap-2 rounded-md bg-slate-800/50 px-3 py-1.5 transition-colors hover:bg-slate-800"
          >
            <input
              type="checkbox"
              checked={value}
              onChange={() => onChange(key as keyof ChartOptions)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
            />
            <span className="text-xs font-bold text-slate-400 uppercase group-hover:text-slate-200">
              {key}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};
