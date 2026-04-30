export type getStockHistoryResponseDto = {
  symbol: string;
  company_name: string;
  data: MarketData[];
};
export type GetStockListResponseDto = StockItem[];

export type StockSearchItem = {
  symbol: string;
  name: string;
};
export type SearchStocksResponseDto = StockSearchItem[];
