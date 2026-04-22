import type { StrategyParams } from '@/widgets/stock-dashboard/model/dashborad-store';

import { StrategyControls } from './strategy-controls';

interface Props {
  params: StrategyParams;
  onParamChange: (key: keyof StrategyParams, value: number | boolean) => void;
}

export const ChartControls = ({ params, onParamChange }: Props) => {
  return <StrategyControls params={params} onParamChange={onParamChange} />;
};
