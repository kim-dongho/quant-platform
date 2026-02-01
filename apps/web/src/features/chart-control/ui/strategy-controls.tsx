import { useEffect, useState } from 'react';

interface Props {
  params: {
    sma_short: number;
    sma_long: number;
    rsi_buy_k: number;
  };
  onParamChange: (key: string, value: number) => void;
  onApply: () => void;
}

export const StrategyControls = ({ params, onParamChange, onApply }: Props) => {
  const [localParams, setLocalParams] = useState(params);

  useEffect(() => {
    setLocalParams(params);
  }, [params]);

  const handleApply = () => {
    Object.entries(localParams).forEach(([key, value]) => {
      onParamChange(key, value as number);
    });
    onApply();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
        Strategy Parameters
      </span>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          {/* SMA Short Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase">SMA Short</label>
            <input
              type="number"
              value={localParams.sma_short}
              onKeyDown={handleKeyDown}
              onChange={(e) =>
                setLocalParams({ ...localParams, sma_short: Number(e.target.value) })
              }
              className="w-20 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-slate-700 outline-none focus:ring-emerald-500"
            />
          </div>

          {/* SMA Long Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase">SMA Long</label>
            <input
              type="number"
              onKeyDown={handleKeyDown}
              value={localParams.sma_long}
              onChange={(e) => setLocalParams({ ...localParams, sma_long: Number(e.target.value) })}
              className="w-20 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-slate-700 outline-none focus:ring-emerald-500"
            />
          </div>

          {/* RSI Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase">RSI Limit</label>
            <input
              type="number"
              onKeyDown={handleKeyDown}
              value={localParams.rsi_buy_k}
              onChange={(e) =>
                setLocalParams({ ...localParams, rsi_buy_k: Number(e.target.value) })
              }
              className="w-20 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-slate-700 outline-none focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={handleApply}
          className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-900/40 active:scale-95 sm:ml-0"
        >
          <span>Run Backtest</span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
