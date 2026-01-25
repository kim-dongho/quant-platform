package controller

import (
	"quant-server/internal/database"
	"quant-server/internal/model"

	"github.com/gofiber/fiber/v2"
)

// GetStockHistory godoc
// @Summary      주식 히스토리 조회
// @Description  특정 심볼의 회사명과 과거 시세 데이터를 조회합니다.
// @Tags         stocks
// @Accept       json
// @Produce      json
// @Param        symbol   path      string  true  "Stock Symbol (e.g., NVDA)"
// @Success      200      {object}  model.StockHistoryResponse // ✅ {array}에서 {object}로 변경
// @Failure      400      {object}  map[string]string
// @Failure      404      {object}  map[string]string
// @Router       /stocks/{symbol}/history [get]
func GetStockHistory(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	if symbol == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Symbol is required"})
	}

	db := database.DB

	// 1. 회사명 조회
	var companyName string

	// 데이터가 없어도 에러로 끊지 않고 티커를 기본값으로 쓰기 위해 가볍게 처리
	_ = db.Table("stocks").Select("name").Where("symbol = ?", symbol).Row().Scan(&companyName)
	if companyName == "" {
		companyName = symbol
	}

	// 2. 시세 데이터 조회
	var history []model.MarketData
	result := db.Table("market_data").
		Select("DISTINCT ON (time) TO_CHAR(time, 'YYYY-MM-DD') as time, open, high, low, close, volume").
		Where("symbol = ?", symbol).
		Order("time ASC").
		Find(&history)

	// 3. 에러 처리 (result.Error 사용)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database query failed"})
	}

	if len(history) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "No history data found for " + symbol})
	}

	// 4. 최종 응답 구조 생성
	response := model.StockHistoryResponse{
		Symbol:      symbol,
		CompanyName: companyName,
		Data:        history,
	}

	return c.JSON(response)
}
