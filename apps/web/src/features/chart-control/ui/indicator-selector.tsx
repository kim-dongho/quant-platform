import { ChartOptions } from '@/entities/stock/model/stocks-common';

interface Props {
  options: ChartOptions;
  onChange: (key: keyof ChartOptions) => void;
}

const LABELS: Record<keyof ChartOptions, string> = {
  volume: 'Volume',
  rsi: 'RSI',
  macd: 'MACD',
  sma: 'SMA (10, 50)',
  bollinger: 'Bollinger',
};

export const IndicatorSelector = ({ options, onChange }: Props) => {
  return (
    <div className="scrollbar-hide flex h-14 shrink-0 items-center gap-4 overflow-x-auto border-b border-outline-variant/30 bg-surface-container-lowest px-4">
      <span className="mr-2 text-[11px] font-semibold tracking-wider whitespace-nowrap text-on-surface-variant uppercase">
        Visual Indicators
      </span>

      {(Object.entries(options) as [keyof ChartOptions, boolean][]).map(([key, value]) => {
        const label = LABELS[key] ?? key;
        const isPrimaryActive = value && key === 'sma';

        return (
          <label
            key={key}
            className={[
              'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 whitespace-nowrap transition-colors',
              isPrimaryActive
                ? 'border-primary/20 bg-primary-container'
                : 'border-outline-variant/50 bg-surface hover:bg-surface-container-low',
            ].join(' ')}
          >
            <input
              type="checkbox"
              checked={value}
              onChange={() => onChange(key)}
              className="h-3.5 w-3.5 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary"
            />
            <span
              className={[
                'text-xs font-medium',
                isPrimaryActive ? 'text-on-primary-container' : 'text-on-surface',
              ].join(' ')}
            >
              {label}
            </span>
          </label>
        );
      })}

      <div className="ml-auto flex items-center gap-2 border-l border-outline-variant/30 pl-4">
        <button className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined text-[18px]">zoom_in</span>
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined text-[18px]">zoom_out</span>
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined text-[18px]">fullscreen</span>
        </button>
      </div>
    </div>
  );
};
