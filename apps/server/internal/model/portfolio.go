package model

import (
	"encoding/json"
	"time"
)

// PortfolioRule — 저장된 포트폴리오 스크리닝 룰셋.
// config는 JSONB로 저장되며, 엔진의 screen/backtest 엔드포인트 요청 스키마와 동일한 구조:
//
//	{
//	  "universe": "sp500",
//	  "clauses": [{"factor": "rsi_14", "op": "<", "value": 30}],
//	  "max_positions": 10
//	}
type PortfolioRule struct {
	ID        uint            `json:"id" gorm:"primaryKey"`
	Name      string          `json:"name" gorm:"not null"`
	Config    json.RawMessage `json:"config" gorm:"type:jsonb;not null"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func (PortfolioRule) TableName() string {
	return "portfolio_rules"
}

// PortfolioRuleRequest — 생성/수정 시 프론트에서 보내는 payload
type PortfolioRuleRequest struct {
	Name   string          `json:"name" example:"오버솔드 리버설"`
	Config json.RawMessage `json:"config"`
}
