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
      <label className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={localStr}
        disabled={disabled}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className={[
          'w-full rounded-md border px-2 py-1.5 font-mono text-sm text-on-surface transition-all outline-none',
          'bg-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-50',
          isError
            ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
            : 'border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary',
        ].join(' ')}
      />
    </div>
  );
};
