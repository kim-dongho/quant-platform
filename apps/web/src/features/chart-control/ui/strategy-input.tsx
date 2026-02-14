'use client';

import { useEffect, useState } from 'react';

interface StrategyInputProps {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (val: number) => void;
  onEnter?: () => void;
}

export const StrategyInput = ({
  label,
  value,
  disabled,
  onChange,
  onEnter,
}: StrategyInputProps) => {
  const [localStr, setLocalStr] = useState('');

  useEffect(() => {
    setLocalStr(Number.isNaN(value) ? '' : value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setLocalStr(rawValue);

    // 빈 문자열이면 NaN 전달, 아니면 숫자 변환
    if (rawValue === '') {
      onChange(NaN);
    } else {
      const num = parseFloat(rawValue);
      onChange(isNaN(num) ? NaN : num);
    }
  };

  const isError = !disabled && Number.isNaN(value);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={localStr}
        disabled={disabled}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className={`w-16 rounded bg-slate-800 px-2 py-1 text-sm text-white ring-1 transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          isError ? 'ring-red-500 focus:ring-red-500' : 'ring-slate-700 focus:ring-emerald-500'
        }`}
      />
    </div>
  );
};
