interface Props {
  data: { time: string; value: number }[];
  winRate?: number;
  trades?: number;
}

export const PerformanceCard = ({ data, winRate = 68, trades = 142 }: Props) => {
  const lastValue = data.length > 0 ? data[data.length - 1].value : 1.0;
  const percentage = (lastValue - 1) * 100;
  const isPositive = percentage >= 0;
  const formatted = data.length > 0 ? `${isPositive ? '+' : ''}${percentage.toFixed(1)}%` : '--';

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
        Backtest Performance
      </span>
      <div className="flex items-baseline gap-2">
        <h2
          className={`text-[30px] leading-[38px] font-bold tracking-tight ${
            isPositive ? 'text-secondary' : 'text-error'
          }`}
        >
          {formatted}
        </h2>
        <span className={`flex items-center ${isPositive ? 'text-secondary' : 'text-error'}`}>
          <span className="material-symbols-outlined text-base">
            {isPositive ? 'trending_up' : 'trending_down'}
          </span>
        </span>
      </div>
      <p className="mt-1 text-[13px] text-on-surface-variant">
        Win Rate: {winRate}% • Trades: {trades}
      </p>
    </div>
  );
};
