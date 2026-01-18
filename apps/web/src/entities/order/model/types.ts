// 'BUY' 또는 'SELL' 두 가지 문자열만 허용하는 타입입니다.
export type OrderSide = 'BUY' | 'SELL';

export interface Order {
  id?: number;
  symbol: string;
  side: OrderSide; // 여기서 사용됨
  price: number;
  quantity: number;
  createdAt?: string;
}