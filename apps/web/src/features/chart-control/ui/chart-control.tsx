'use client';

export interface IndicatorState {
  volume: boolean;
  rsi: boolean;
  macd: boolean;
  bollinger: boolean;
}

interface Props {
  options: IndicatorState;
  onChange: (key: keyof IndicatorState) => void;
}

export const ChartControls = ({ options, onChange }: Props) => {
  return (
    <div className="flex gap-4 mb-2 p-2 bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-x-auto">
      {Object.entries(options).map(([key, value]) => (
        <label 
          key={key} 
          className="flex items-center space-x-2 cursor-pointer select-none hover:bg-[#333] px-3 py-1 rounded transition-colors"
        >
          <div className="relative">
            <input
              type="checkbox"
              checked={value}
              onChange={() => onChange(key as keyof IndicatorState)}
              className="sr-only" // 기본 체크박스 숨김
            />
            <div className={`w-10 h-6 rounded-full shadow-inner transition-colors ${value ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`}></div>
          </div>
          <span className="text-sm font-bold text-gray-300 uppercase">{key}</span>
        </label>
      ))}
    </div>
  );
};