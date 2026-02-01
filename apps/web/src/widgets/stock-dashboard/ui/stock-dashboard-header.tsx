import { StockSearch } from '@/features/stock-search/ui/stock-search';

import { StockLogo } from '@/shared/ui/stock-logo';

interface Props {
  companyName: string;
  symbol: string;
  onSearch: (symbol: string) => void;
}

export const DashboardHeader = ({ companyName, symbol, onSearch }: Props) => (
  <div className="flex items-end justify-between">
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <StockLogo symbol={symbol} size={48} />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-white">{companyName || symbol}</h1>
        <span className="text-2xl font-bold tracking-tight text-slate-500 uppercase">{symbol}</span>
        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold tracking-widest text-emerald-500">
          LIVE
        </span>
      </div>
    </div>
    <StockSearch onSearch={onSearch} />
  </div>
);
