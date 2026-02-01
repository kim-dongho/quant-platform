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
  return (
    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center gap-6">
      {/* 지표 On/Off 체크박스 */}
      <div className="flex gap-4 border-r border-slate-700 pr-6">
        {Object.entries(options).map(([key, value]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={value}
              onChange={() => onChange(key as keyof ChartOptions)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 uppercase">{key}</span>
          </label>
        ))}
      </div>

      {/* 전략 파라미터 조절 슬라이더/인풋 */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase">SMA Short</span>
          <input 
            type="number" 
            value={params.sma_short} 
            onChange={(e) => onParamChange('sma_short', Number(e.target.value))}
            className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase">SMA Long</span>
          <input 
            type="number" 
            value={params.sma_long} 
            onChange={(e) => onParamChange('sma_long', Number(e.target.value))}
            className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase">RSI Buy Limit</span>
          <input 
            type="number" 
            value={params.rsi_buy_k} 
            onChange={(e) => onParamChange('rsi_buy_k', Number(e.target.value))}
            className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 적용 버튼 */}
      <button 
        onClick={onApply}
        className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/20"
      >
        Run Backtest
      </button>
    </div>
  );
};