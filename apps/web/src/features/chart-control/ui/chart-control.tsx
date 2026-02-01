import { useEffect, useState } from 'react';

import { ChartOptions } from '@/entities/stock/model/stocks-common';

interface Props {
  options: ChartOptions;
  params: {
    sma_short: number;
    sma_long: number;
    rsi_buy_k: number;
  };
  onChange: (key: keyof ChartOptions) => void;
  onParamChange: (key: string, value: number) => void;
  onApply: () => void; // 설정 적용 버튼
}

export const ChartControls = ({ options, params, onChange, onParamChange, onApply }: Props) => {
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

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      {/* 지표 On/Off 체크박스 */}
      <div className="flex gap-4 border-r border-slate-700 pr-6">
        {Object.entries(options).map(([key, value]) => (
          <label key={key} className="group flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={value}
              onChange={() => onChange(key as keyof ChartOptions)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-400 uppercase group-hover:text-slate-200">
              {key}
            </span>
          </label>
        ))}
      </div>

      {/* 전략 파라미터 조절 슬라이더/인풋 */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">SMA Short</span>
          <input
            type="number"
            value={localParams.sma_short}
            onChange={(e) => setLocalParams({ ...localParams, sma_short: Number(e.target.value) })}
            className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">SMA Long</span>
          <input
            type="number"
            value={localParams.sma_long}
            onChange={(e) => setLocalParams({ ...localParams, sma_long: Number(e.target.value) })}
            className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">RSI Buy Limit</span>
          <input
            type="number"
            value={localParams.rsi_buy_k}
            onChange={(e) => setLocalParams({ ...localParams, rsi_buy_k: Number(e.target.value) })}
            className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 적용 버튼 */}
      <button
        onClick={handleApply}
        className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-colors hover:bg-emerald-500"
      >
        Run Backtest
      </button>
    </div>
  );
};
