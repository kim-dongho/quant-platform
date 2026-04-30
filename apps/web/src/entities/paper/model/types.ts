export interface PaperHolding {
  symbol: string;
  name: string;
  qty: number;
  avg_cost: number;
  current_price: number;
  eval_amount: number;
  profit: number;
  profit_rate: number;
}

export interface PaperSummary {
  total_eval: number;
  cash: number;
  deposit_d2: number;
  total_profit: number;
}

export interface PaperBalance {
  mode: 'paper' | 'real';
  holdings: PaperHolding[];
  summary: PaperSummary;
}

export interface PaperQuote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  change: number;
  change_rate: number;
  volume: number;
}

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'pending' | 'partial' | 'filled';

export interface PaperOrder {
  order_no: string;
  date: string;
  time: string;
  symbol: string;
  name: string;
  side: OrderSide;
  qty: number;
  price: number;
  filled_qty: number;
  filled_avg_price: number;
  status: OrderStatus;
  order_type: OrderType;
}

export interface PlaceOrderRequest {
  symbol: string;
  qty: number;
  side: OrderSide;
  order_type?: OrderType;
  price?: number;
}

export interface PlaceOrderResponse {
  side: OrderSide;
  symbol: string;
  qty: number;
  order_type: OrderType;
  price: number | null;
  order_no: string;
  branch_no: string;
  order_time: string;
  mode: 'paper' | 'real';
}
