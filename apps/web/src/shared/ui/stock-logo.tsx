import { useState } from 'react';

import Image from 'next/image';

interface Props {
  symbol: string;
  size?: number;
}

// 토스 증권 로고 CDN — 미국(NVDA/AAPL/...)·국내(6자리 숫자) 모두 커버.
// 국내 티커는 내부 포맷상 '.KS' / '.KQ' 접미사를 붙여 저장하므로 로고 조회 시에는 제거.
const toLogoSymbol = (symbol: string) => symbol.replace(/\.(KS|KQ)$/i, '');

export const StockLogo = ({ symbol, size = 40 }: Props) => {
  const [error, setError] = useState(false);

  if (error || !symbol) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-slate-700 font-bold text-white select-none"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {symbol.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  const logoUrl = `https://static.toss.im/png-icons/securities/icn-sec-fill-${toLogoSymbol(symbol)}.png`;

  return (
    <Image
      src={logoUrl}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className="rounded-full bg-white object-contain shadow-md"
      onError={() => setError(true)}
      unoptimized
    />
  );
};
