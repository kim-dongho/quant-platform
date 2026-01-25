package model

// TimeSeriesData: Lightweight Charts와 일관성을 맞춘 개별 데이터 포인트
type TimeSeriesData struct {
	Time  string  `json:"time" example:"2025-01-25"`
	Value float64 `json:"value" example:"1.2345"`
}

// BacktestRequest: 프론트엔드에서 백테스트를 요청할 때 사용하는 구조체
type BacktestRequest struct {
	Ticker   string `json:"ticker" example:"NVDA" extensions:"x-order=1"`
	Strategy string `json:"strategy" example:"trend_following" extensions:"x-order=2"`

	// Params: 지표 설정값 (예: {"sma_short": 5, "use_rsi": true})
	Params map[string]interface{} `json:"params" example:"sma_short:5,sma_long:20,use_rsi:true" extensions:"x-order=3"`
}

// BacktestResponse: 엔진의 계산 결과를 담아 프론트엔드로 보내는 구조체
type BacktestResponse struct {
	Ticker      string           `json:"ticker" example:"NVDA"`
	Results     []TimeSeriesData `json:"results"` // ✅ [ {time, value}, ... ] 구조로 일관성 확보
	FinalReturn float64          `json:"final_return" example:"34326.76"`
}
