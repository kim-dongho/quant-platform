import type { StrategyParams } from '@/widgets/stock-dashboard/model/dashborad-store';

import { ChartOptions } from '@/entities/stock/model/stocks-common';

import { StrategyControls } from './strategy-controls';

interface Props {
  params: StrategyParams;

  onParamChange: (key: keyof StrategyParams, value: number | boolean) => void;
  onApply: () => void;
}

export const ChartControls = ({ params, onParamChange, onApply }: Props) => {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
      {/* 전략 설정 영역 */}
      <StrategyControls params={params} onParamChange={onParamChange} onApply={onApply} />
    </div>
  );
};
