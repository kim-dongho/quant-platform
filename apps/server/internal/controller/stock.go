package controller

import (
	"quant-server/internal/database"
	"quant-server/internal/model"

	"github.com/gofiber/fiber/v2"
)

// GetStockHistory godoc
// @Summary      주식 히스토리 조회
// @Description  특정 심볼의 과거 시세 데이터를 조회합니다.
// @Tags         stocks
// @Accept       json
// @Produce      json
// @Param        symbol   path      string  true  "Stock Symbol (e.g., RKLB)"
// @Success      200      {array}   model.MarketData
// @Failure      404      {object}  map[string]string
// @Router       /stocks/{symbol}/history [get]
func GetStockHistory(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	if symbol == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Symbol is required"})
	}

	// 1. 결과 데이터를 담을 슬라이스 (일관된 구조)
	var history []model.MarketData

	// 2. DB 조회
	db := database.DB

	result := db.Table("market_data").
		Select("TO_CHAR(time, 'YYYY-MM-DD') as time, open, high, low, close, volume").
		Where("symbol = ?", symbol).
		Order("time ASC").
		Find(&history)

	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database query failed"})
	}

	// 3. 데이터가 없을 경우 처리
	if len(history) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "No history data found for " + symbol})
	}

	// 4. 응답 (RunBacktest와 동일하게 JSON 반환)
	return c.JSON(history)
}
