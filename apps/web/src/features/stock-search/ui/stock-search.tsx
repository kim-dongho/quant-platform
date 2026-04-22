'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';

import { useStockListQuery } from '@/entities/stock/api/stocks-queries';

interface Props {
  currentSymbol: string;
  onSearch: (symbol: string) => void;
}

export const StockSearch = ({ currentSymbol, onSearch }: Props) => {
  const [query, setQuery] = useState(currentSymbol);
  const [isOpen, setIsOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: stocks = [] } = useStockListQuery();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setQuery(currentSymbol);
  }, [currentSymbol]);

  const filteredStocks = stocks.filter((stock) =>
    stock.symbol.toUpperCase().includes(query.toUpperCase()),
  );

  const handleSubmit = (symbol: string) => {
    if (!symbol) return;
    const upperSymbol = symbol.toUpperCase();
    setQuery(upperSymbol);
    onSearch(upperSymbol);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit(query);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">search</span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="block w-full rounded-md border border-outline-variant/50 bg-surface py-1.5 pr-3 pl-9 text-sm text-on-surface placeholder-on-surface-variant outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="Search Ticker..."
        />
      </div>

      {isOpen && query.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-outline-variant/50 bg-surface-container-lowest py-1 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
          {filteredStocks.map((stock) => (
            <li
              key={stock.symbol}
              onClick={() => handleSubmit(stock.symbol)}
              className="group flex cursor-pointer items-center justify-between px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <span className="font-semibold">{stock.symbol}</span>
              <span className="text-[10px] text-on-surface-variant group-hover:text-primary">
                In DB
              </span>
            </li>
          ))}

          {!filteredStocks.some((s) => s.symbol === query.toUpperCase()) && (
            <li
              onClick={() => handleSubmit(query)}
              className="cursor-pointer border-t border-outline-variant/30 bg-surface-container-low/50 px-4 py-2 text-sm text-primary hover:bg-surface-container-low"
            >
              <span className="mr-2">🔍</span>
              Search for <span className="font-bold">"{query.toUpperCase()}"</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
