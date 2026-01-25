package model

// StockHistoryResponse 주식 히스토리 응답 구조체
// @Description 주식의 기본 정보와 과거 시세 데이터를 포함합니다.
type StockHistoryResponse struct {
	Symbol      string       `json:"symbol" example:"NVDA" extensions:"x-order=1"`
	CompanyName string       `json:"company_name" example:"NVIDIA Corporation" extensions:"x-order=2"`
	Data        []MarketData `json:"data" extensions:"x-order=3"`
}

// MarketData 일자별 시세 데이터
// @Description 개별 일자의 시가, 고가, 저가, 종가 및 거래량 정보
type MarketData struct {
	Time   string  `json:"time" example:"2024-01-25"`
	Open   float64 `json:"open" example:"150.25"`
	High   float64 `json:"high" example:"155.00"`
	Low    float64 `json:"low" example:"149.50"`
	Close  float64 `json:"close" example:"153.40"`
	Volume int64   `json:"volume" example:"1200000"`
}

func (MarketData) TableName() string {
	return "market_data"
}
