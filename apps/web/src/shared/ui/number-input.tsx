'use client';

import type { InputHTMLAttributes } from 'react';
import { useEffect, useRef, useState } from 'react';

// 숫자 input — controlled 이면서 빈 문자열 허용. blur 시 빈칸이면 마지막 valid value 로 복원.
// `value/onChange` 는 number, 내부 표시는 string 으로 분리해 backspace 로 0 이 안 지워지는 문제 해결.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
};

export const NumberInput = ({ value, onChange, min, max, onBlur, ...rest }: Props) => {
  const [text, setText] = useState<string>(String(value));
  const focusedRef = useRef(false);

  // 외부 value 가 바뀌면 텍스트도 동기화 — 단, 사용자 입력 중 (focus 상태) 엔 건드리지 않음.
  useEffect(() => {
    if (!focusedRef.current) {
      setText(String(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (v === '' || v === '-') return; // 입력 중 — 부모 갱신 보류
        const n = Number(v);
        if (Number.isNaN(n)) return;
        let clamped = n;
        if (min !== undefined) clamped = Math.max(min, clamped);
        if (max !== undefined) clamped = Math.min(max, clamped);
        onChange(clamped);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        if (text === '' || text === '-' || Number.isNaN(Number(text))) {
          setText(String(value));
        }
        onBlur?.(e);
      }}
      {...rest}
    />
  );
};
