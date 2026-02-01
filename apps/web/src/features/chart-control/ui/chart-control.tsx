import { ChartOptions } from '@/entities/stock/model/stocks-common';

import { IndicatorSelector } from './indicator-selector';
import { StrategyControls } from './strategy-controls';

interface Props {
  options: ChartOptions;
  params: {
    sma_short: number;
    sma_long: number;
    rsi_buy_k: number;
  };
  onChange: (key: keyof ChartOptions) => void;
  onParamChange: (key: string, value: number) => void;
  onApply: () => void;
}

export const ChartControls = ({ options, params, onChange, onParamChange, onApply }: Props) => {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
      {/* 1. 지표 선택 영역 */}
      <IndicatorSelector options={options} onChange={onChange} />

      {/* 구분선 */}
      <div className="h-px w-full bg-slate-800" />

      {/* 2. 전략 설정 영역 */}
      <StrategyControls params={params} onParamChange={onParamChange} onApply={onApply} />
    </div>
  );
};
