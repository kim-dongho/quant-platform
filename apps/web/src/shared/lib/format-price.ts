// 심볼의 거래 통화 판정 — '.KS' / '.KQ' 접미사는 KRW, 그 외 미국 티커는 USD
export const getCurrency = (symbol: string | undefined): 'KRW' | 'USD' => {
  if (!symbol) return 'USD';
  return /\.(KS|KQ)$/i.test(symbol) ? 'KRW' : 'USD';
};

/**
 * 심볼에 맞는 가격 포맷:
 *  - KRW: 천단위 콤마 + 소수점 없음 (예: ₩123,450)
 *  - USD: 천단위 콤마 + 소수점 2자리 (예: $12.34)
 * symbol을 생략하면 USD 포맷.
 */
export const formatPrice = (value: number | null | undefined, symbol?: string): string => {
  if (value == null || !Number.isFinite(value)) return '--';
  const currency = getCurrency(symbol);
  if (currency === 'KRW') {
    return `₩${Math.round(value).toLocaleString('ko-KR')}`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
