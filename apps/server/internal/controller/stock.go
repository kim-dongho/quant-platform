package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"quant-server/internal/database"
	"quant-server/internal/model"
	"strconv"
	"strings"

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

// 엔진에서 NASDAQ 기준 가장 최근 마감 세션 날짜(YYYY-MM-DD)를 조회
func getLastTradingDay() (string, error) {
	resp, err := http.Get("http://engine:8000/market/last_session")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("engine returned status: %d", resp.StatusCode)
	}

	var body struct {
		Date string `json:"date"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	return body.Date, nil
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
// @Failure      500      {object}  map[string]string
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
				"error":   "Symbol not found or data unavailable",
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
	} else {
		// 데이터는 있는데 최신 bar가 마지막 마감 세션보다 오래됐으면 백필
		lastBar := history[len(history)-1].Time
		if lastSession, err := getLastTradingDay(); err == nil && lastBar < lastSession {
			fmt.Printf("🔄 Data stale for %s (last bar: %s, last session: %s). Refreshing...\n", symbol, lastBar, lastSession)
			if ingestErr := triggerIngestion(symbol); ingestErr != nil {
				// 백필 실패해도 기존 데이터는 반환
				fmt.Printf("⚠️ Backfill failed, returning stale data: %v\n", ingestErr)
			} else {
				history = history[:0]
				db.Table("market_data").
					Select("DISTINCT ON (time) TO_CHAR(time, 'YYYY-MM-DD') as time, open, high, low, close, volume").
					Where("symbol = ?", symbol).
					Order("time ASC").
					Find(&history)
			}
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

type StockItem struct {
	Symbol string `json:"symbol" example:"NVDA"`
}

// GetStockList godoc
// @Summary      종목 리스트 조회 (자동완성용)
// @Description  DB에 저장된 중복 없는 종목 심볼 목록을 조회합니다. 검색창의 자동완성(Autocomplete) 기능에 사용됩니다.
// @Tags         stocks
// @Produce      json
// @Success      200  {array}   StockItem
// @Failure      500  {object}  map[string]string
// @Router       /stocks/list [get]
func GetStockList(c *fiber.Ctx) error {
	// 1. 중복 제거된 종목 심볼 가져오기
	var symbols []string

	// GORM 예시: market_data 테이블에서 symbol 컬럼만 distinct로 가져옴
	result := database.DB.Table("market_data").
		Select("DISTINCT symbol").
		Order("symbol ASC").
		Pluck("symbol", &symbols).
		Error

	if result != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to fetch stock list",
		})
	}

	// 2. 프론트엔드 포맷에 맞게 변환 (Array of Objects)
	response := make([]StockItem, len(symbols))
	for i, s := range symbols {
		response[i] = StockItem{Symbol: s}
	}

	// 3. JSON 응답
	return c.JSON(response)
}

type StockSearchItem struct {
	Symbol string `json:"symbol" example:"RKLB"`
	Name   string `json:"name"   example:"Rocket Lab Corporation"`
}

// SearchStocks godoc
// @Summary      종목 자동완성 검색
// @Description  symbol 또는 회사명(영문·한국어)에 q가 포함된 종목을 랭킹 순으로 반환합니다. 순위: 완전일치 > symbol 접두사 > name 접두사 > symbol 부분일치 > name 부분일치.
// @Tags         stocks
// @Produce      json
// @Param        q      query     string  true   "검색어 (symbol 또는 회사명 일부)"
// @Param        limit  query     int     false  "최대 반환 개수 (기본 20, 최대 100)"
// @Success      200    {array}   StockSearchItem
// @Failure      500    {object}  map[string]string
// @Router       /stocks/search [get]
func SearchStocks(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return c.JSON([]StockSearchItem{})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	prefix := q + "%"
	contains := "%" + q + "%"

	items := make([]StockSearchItem, 0)
	err := database.DB.Raw(`
		SELECT symbol, name
		FROM stocks
		WHERE UPPER(symbol) LIKE UPPER(?) OR name ILIKE ?
		ORDER BY
		  CASE
		    WHEN UPPER(symbol) = UPPER(?)      THEN 1
		    WHEN UPPER(symbol) LIKE UPPER(?)   THEN 2
		    WHEN name ILIKE ?                  THEN 3
		    WHEN UPPER(symbol) LIKE UPPER(?)   THEN 4
		    ELSE 5
		  END,
		  LENGTH(symbol),
		  symbol
		LIMIT ?
	`, contains, contains, q, prefix, prefix, contains, limit).Scan(&items).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(items)
}
