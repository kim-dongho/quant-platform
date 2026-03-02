package controller

import (
	"fmt"
	"net/http"
	"quant-server/internal/database"
	"quant-server/internal/model"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// Python 엔진에 1분봉 데이터 수집 요청을 보내는 헬퍼 함수
func triggerIngestion1m(symbol string) error {
	url := fmt.Sprintf("http://engine:8000/ingest_1m/%s", symbol)

	resp, err := http.Post(url, "application/json", nil)
	if err != nil {
		return fmt.Errorf("engine connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("engine returned status: %d", resp.StatusCode)
	}
	return nil
}

// GetIntradayCandles godoc
// @Summary      1분봉 시세 조회
// @Description  특정 심볼의 1분봉(Intraday) 시세 데이터를 조회합니다. (없으면 자동 수집)
// @Tags         stocks
// @Accept       json
// @Produce      json
// @Param        symbol   path      string  true  "Stock Symbol (e.g., NVDA)"
// @Param        limit    query     int     false "가져올 데이터 갯수 (기본값: 1000)"
// @Success      200      {array}   model.IntradayCandle
// @Failure      400      {object}  map[string]string
// @Failure      404      {object}  map[string]string
// @Failure      500      {object}  map[string]string
// @Router       /stocks/{symbol}/intraday [get]
func GetIntradayCandles(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	if symbol == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Symbol is required"})
	}

	limit := 1000
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil {
			limit = parsed
		}
	}

	db := database.DB
	candles := make([]model.IntradayCandle, 0)

	query := `
		SELECT EXTRACT(EPOCH FROM time)::bigint AS time, open, high, low, close, volume
		FROM (
			SELECT time, open, high, low, close, volume
			FROM market_data_1m
			WHERE symbol = ?
			ORDER BY time DESC
			LIMIT ?
		) AS sub
		ORDER BY time ASC
	`

	// 1차 DB 조회
	result := db.Raw(query, symbol, limit).Scan(&candles)

	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to fetch intraday data",
			"details": result.Error.Error(),
		})
	}

	if len(candles) == 0 {
		fmt.Printf("🔍 No 1m data for %s in DB. Triggering 1m ingestion...\n", symbol)

		// Python 엔진 호출
		if err := triggerIngestion1m(symbol); err != nil {
			fmt.Printf("❌ 1m Ingestion failed: %v\n", err)
			return c.Status(404).JSON(fiber.Map{
				"error":   "Symbol not found or 1m data unavailable",
				"details": err.Error(),
			})
		}

		db.Raw(query, symbol, limit).Scan(&candles)

		if len(candles) == 0 {
			return c.Status(500).JSON(fiber.Map{"error": "1m Data ingested but retrieval failed"})
		}
	}

	return c.JSON(candles)
}