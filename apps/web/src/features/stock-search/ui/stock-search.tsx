'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';

import { useStockSearchQuery } from '@/entities/stock/api/stocks-queries';

interface Props {
  currentSymbol: string;
  onSearch: (symbol: string) => void;
}

export const StockSearch = ({ currentSymbol, onSearch }: Props) => {
  const [query, setQuery] = useState(currentSymbol);
  const [debounced, setDebounced] = useState(query);
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 부모에서 내려준 symbol이 바뀌면 input 동기화
  useEffect(() => {
    setQuery(currentSymbol);
  }, [currentSymbol]);

  // 300ms 디바운스
  useEffect(() => {
    const h = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(h);
  }, [query]);

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

  const { data } = useStockSearchQuery(debounced, { enabled: isOpen });
  const results = data ?? [];

  // 결과가 바뀔 때 highlight 초기화
  useEffect(() => {
    setHighlight(0);
  }, [results]);

  const selectItem = (item: { symbol: string; name: string }) => {
    setQuery(item.symbol);
    onSearch(item.symbol);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[highlight];
      if (target) selectItem(target);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const showDropdown = isOpen && debounced.length > 0 && results.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="group relative">
        <div className="text-on-surface-variant pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
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
          className="border-outline-variant/50 bg-surface text-on-surface placeholder-on-surface-variant focus:border-primary focus:ring-primary block w-full rounded-md border py-1.5 pr-3 pl-9 text-sm transition-all outline-none focus:ring-1"
          placeholder="회사명 또는 티커로 검색..."
        />
      </div>

      {showDropdown && (
        <ul className="border-outline-variant/50 bg-surface-container-lowest absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border py-1 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
          {results.map((item, i) => (
            <li
              key={item.symbol}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setHighlight(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm transition-colors ${
                i === highlight ? 'bg-surface-container-low' : ''
              }`}
            >
              <span className="text-on-surface truncate font-medium">{item.name}</span>
              <span className="text-on-surface-variant shrink-0 font-mono text-[10px]">
                {item.symbol}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
