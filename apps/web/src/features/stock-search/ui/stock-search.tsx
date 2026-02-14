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

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 필터링 로직
  const filteredStocks = stocks.filter((stock) =>
    stock.symbol.toUpperCase().includes(query.toUpperCase()),
  );

  // 검색 실행 (리스트 선택 or 엔터 입력 시)
  const handleSubmit = (symbol: string) => {
    if (!symbol) return;
    const upperSymbol = symbol.toUpperCase();

    setQuery(upperSymbol);
    onSearch(upperSymbol);
    setIsOpen(false);
  };

  // 엔터키 핸들러
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(query);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-64">
      {/* 검색 입력창 */}
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
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
          className="block w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pr-4 pl-10 text-sm text-white placeholder-slate-400 transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          placeholder="Search Ticker..."
        />
      </div>

      {/* 드롭다운 리스트 */}
      {isOpen && query.length > 0 && (
        <ul className="scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl">
          {/* 1. DB에 있는 종목들 */}
          {filteredStocks.map((stock) => (
            <li
              key={stock.symbol}
              onClick={() => handleSubmit(stock.symbol)}
              className="group flex cursor-pointer items-center justify-between px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-emerald-600/20 hover:text-white"
            >
              <span className="font-bold">{stock.symbol}</span>
              <span className="text-[10px] text-slate-500 group-hover:text-emerald-400">In DB</span>
            </li>
          ))}

          {/* 2. DB에 없더라도 검색 허용 (강제 수집 요청) */}
          {!filteredStocks.some((s) => s.symbol === query.toUpperCase()) && (
            <li
              onClick={() => handleSubmit(query)}
              className="cursor-pointer border-t border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-emerald-500 hover:bg-slate-700"
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
