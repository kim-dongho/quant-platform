package controller

import (
	"fmt"
	"net/http"
	"quant-server/internal/database"
	"quant-server/internal/model"

	"github.com/gofiber/fiber/v2"
)

// Python 엔진에 데이터 수집 요청을 보내는 헬퍼 함수
func triggerIngestion(symbol string) error {
	url := fmt.Sprintf("http://engine:8000/ingest/%s", symbol)
	
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

// GetStockHistory godoc
// @Summary      주식 히스토리 조회
// @Description  특정 심볼의 회사명과 과거 시세 데이터를 조회합니다. (없으면 자동 수집)
// @Tags         stocks
// @Accept       json
// @Produce      json
// @Param        symbol   path      string  true  "Stock Symbol (e.g., NVDA)"
// @Success      200      {object}  model.StockHistoryResponse
// @Failure      400      {object}  map[string]string
// @Failure      404      {object}  map[string]string
// @Router       /stocks/{symbol}/history [get]
func GetStockHistory(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	if symbol == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Symbol is required"})
	}

	db := database.DB

	// 시세 데이터 DB 조회
	var history []model.MarketData
	
	// 쿼리문 정의 (재사용을 위해 변수에 할당하는 방식도 가능하지만, 직관적으로 반복 작성함)
	db.Table("market_data").
		Select("DISTINCT ON (time) TO_CHAR(time, 'YYYY-MM-DD') as time, open, high, low, close, volume").
		Where("symbol = ?", symbol).
		Order("time ASC").
		Find(&history)

	// 데이터가 없으면(0건) Python 엔진 호출 (Lazy Loading)
	if len(history) == 0 {
		fmt.Printf("🔍 No data for %s in DB. Triggering ingestion...\n", symbol)

		// Python 엔진 호출
		if err := triggerIngestion(symbol); err != nil {
			fmt.Printf("❌ Ingestion failed: %v\n", err)
			// 수집도 실패하면 진짜 없는 종목임
			return c.Status(404).JSON(fiber.Map{
				"error": "Symbol not found or data unavailable",
				"details": err.Error(),
			})
		}

		// 수집 완료 후 DB 다시 조회
		db.Table("market_data").
			Select("DISTINCT ON (time) TO_CHAR(time, 'YYYY-MM-DD') as time, open, high, low, close, volume").
			Where("symbol = ?", symbol).
			Order("time ASC").
			Find(&history)
		
		if len(history) == 0 {
			// 저장했다고 했는데 조회 안되면 시스템 에러
			return c.Status(500).JSON(fiber.Map{"error": "Data ingested but retrieval failed"})
		}
	}

	// 회사명 조회
	var companyName string
	_ = db.Table("stocks").Select("name").Where("symbol = ?", symbol).Row().Scan(&companyName)
	if companyName == "" {
		companyName = symbol
	}

	// 최종 응답 구조 생성
	response := model.StockHistoryResponse{
		Symbol:      symbol,
		CompanyName: companyName,
		Data:        history,
	}

	return c.JSON(response)
}