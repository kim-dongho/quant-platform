package model

// MarketData: DB의 market_data 테이블과 매핑되며 차트의 캔들을 구성하는 데이터
type MarketData struct {
	Time   string  `json:"time" gorm:"column:time" example:"2025-01-25"`
	Open   float64 `json:"open" gorm:"column:open" example:"112.50"`
	High   float64 `json:"high" gorm:"column:high" example:"115.20"`
	Low    float64 `json:"low" gorm:"column:low" example:"111.05"`
	Close  float64 `json:"close" gorm:"column:close" example:"114.10"`
	Volume float64 `json:"volume" gorm:"column:volume" example:"1200000"`
	Symbol string  `json:"symbol" gorm:"column:symbol" example:"NVDA"`
}

func (MarketData) TableName() string {
	return "market_data"
}
