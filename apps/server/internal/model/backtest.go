package model

// 프론트엔드 요청 구조체
type BacktestRequest struct {
	Ticker   string                 `json:"ticker"`
	Strategy string                 `json:"strategy"`
	Params   map[string]interface{} `json:"params"` // 지표 On/Off 및 수치
}

// 엔진 응답 구조체
type BacktestResponse struct {
	Dates       []string  `json:"dates"`
	Values      []float64 `json:"values"`
	FinalReturn float64   `json:"final_return"`
}
