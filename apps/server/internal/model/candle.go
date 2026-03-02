package model

// IntradayCandle 1분봉 시세 데이터
// @Description 실시간 트레이딩 차트(Lightweight Charts)를 위한 1분봉 OHLCV 데이터
type IntradayCandle struct {
	Time   int64   `json:"time" example:"1700000000"` 
	Symbol string  `json:"symbol" gorm:"column:symbol" example:"RKLB"`
	Open   float64 `json:"open" example:"15.25"`
	High   float64 `json:"high" example:"15.80"`
	Low    float64 `json:"low" example:"14.90"`
	Close  float64 `json:"close" example:"15.40"`
	Volume float64 `json:"volume" example:"12500"`
}

func (IntradayCandle) TableName() string {
	return "market_data_1m"
}