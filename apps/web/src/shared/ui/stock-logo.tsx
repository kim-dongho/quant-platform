import { useState } from 'react';

interface Props {
  symbol: string;
  size?: number;
}

export const StockLogo = ({ symbol, size = 40 }: Props) => {
  const [error, setError] = useState(false);

  const logoUrl = `https://financialmodelingprep.com/image-stock/${symbol}.png`;

  if (error || !symbol) {
    // ❌ 이미지 로드 실패 시: 티커 앞글자로 대체 (Fallback)
    return (
      <div
        className="flex items-center justify-center rounded-full bg-slate-700 font-bold text-white select-none"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {symbol.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${symbol} logo`}
      className="rounded-full bg-white object-contain shadow-md"
      style={{ width: size, height: size }}
      onError={() => setError(true)} // 로드 실패 감지
    />
  );
};
