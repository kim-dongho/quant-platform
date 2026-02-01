interface Props {
  data: { time: string; value: number }[];
}

export const PerformanceCard = ({ data }: Props) => {
  const lastValue = data.length > 0 ? data[data.length - 1].value : 1.0;
  const percentage = (lastValue - 1) * 100;
  const isPositive = percentage >= 0;

  return (
    <div className="flex flex-col justify-center rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
        Backtest Performance
      </h3>
      <div className={`text-3xl font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {data.length > 0 ? `${percentage.toFixed(2)}%` : '--'}
      </div>
      <p className="mt-1 text-[10px] text-slate-500 uppercase">Cumulative Return since inception</p>
    </div>
  );
};
