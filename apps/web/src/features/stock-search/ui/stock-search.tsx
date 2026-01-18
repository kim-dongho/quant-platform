'use client';

import { useState } from 'react';

interface Props {
  onSearch: (symbol: string) => void;
}

export const StockSearch = ({ onSearch }: Props) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.toUpperCase());
    setQuery(''); 
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="flex items-center bg-[#222] border border-gray-700 rounded-lg px-3 py-2 w-full max-w-sm focus-within:border-blue-500 transition-colors"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className="w-5 h-5 text-gray-400 mr-2"
      >
        <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
      </svg>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Ticker (e.g. AAPL)"
        className="bg-transparent text-white placeholder-gray-500 outline-none w-full font-mono uppercase"
      />
      
      <button 
        type="submit" 
        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded ml-2 font-bold transition-colors"
      >
        GO
      </button>
    </form>
  );
};