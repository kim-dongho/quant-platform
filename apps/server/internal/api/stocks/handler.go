// Package stocks — 주식 시세/리스트/검색 핸들러. 일부는 DB 직접 조회, 일부는 엔진 프록시.
package stocks

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"quant-server/internal/database"
	"quant-server/internal/model"
	"quant-server/internal/proxy"

	"github.com/gofiber/fiber/v2"
)

// triggerIngestion — Python 엔진에 데이터 수집 요청 송신.
func triggerIngestion(symbol string) error {
	url := fmt.Sprintf("%s/ingest/%s", proxy.EngineBase, symbol)

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

// getLastTradingDay — 엔진에서 NASDAQ 기준 가장 최근 마감 세션 날짜(YYYY-MM-DD)를 조회.
func getLastTradingDay() (string, error) {
	resp, err := http.Get(proxy.EngineBase + "/market/last_session")
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
// @Summary      주식 히스토리 조회 (멀티 타임프레임)
// @Description  특정 심볼의 회사명과 과거 시세 데이터를 조회합니다. timeframe 으로 1d / 1h / 4h 선택.
// @Tags         stocks
// @Accept       json
// @Produce      json
// @Param        symbol     path      string  true   "Stock Symbol (e.g., NVDA)"
// @Param        timeframe  query     string  false  "Timeframe: 1d | 1h | 4h (default 1d)"
// @Success      200        {object}  model.StockHistoryResponse
// @Failure      400        {object}  map[string]string
// @Failure      404        {object}  map[string]string
// @Failure      500        {object}  map[string]string
// @Router       /stocks/{symbol}/history [get]
func GetStockHistory(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	if symbol == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Symbol is required"})
	}

	timeframe := strings.ToLower(strings.TrimSpace(c.Query("timeframe", "1d")))
	if timeframe != "1d" && timeframe != "1h" && timeframe != "4h" {
		return c.Status(400).JSON(fiber.Map{"error": "timeframe must be 1d, 1h, or 4h"})
	}

	db := database.DB
	var history []model.MarketData

	switch timeframe {
	case "1d":
		// 일봉 — 기존 동작 유지. 데이터 없으면 lazy ingest.
		db.Table("market_data").
			Select("DISTINCT ON (time) TO_CHAR(time, 'YYYY-MM-DD') as time, open, high, low, close, volume").
			Where("symbol = ?", symbol).
			Order("time ASC").
			Find(&history)

		if len(history) == 0 {
			fmt.Printf("🔍 No data for %s in DB. Triggering ingestion...\n", symbol)
			if err := triggerIngestion(symbol); err != nil {
				fmt.Printf("❌ Ingestion failed: %v\n", err)
				return c.Status(404).JSON(fiber.Map{
					"error":   "Symbol not found or data unavailable",
					"details": err.Error(),
				})
			}
			db.Table("market_data").
				Select("DISTINCT ON (time) TO_CHAR(time, 'YYYY-MM-DD') as time, open, high, low, close, volume").
				Where("symbol = ?", symbol).
				Order("time ASC").
				Find(&history)
			if len(history) == 0 {
				return c.Status(500).JSON(fiber.Map{"error": "Data ingested but retrieval failed"})
			}
		} else {
			// 데이터는 있는데 최신 bar가 마지막 마감 세션보다 오래됐으면 백필
			lastBar := history[len(history)-1].Time
			if lastSession, err := getLastTradingDay(); err == nil && lastBar < lastSession {
				fmt.Printf("🔄 Data stale for %s (last bar: %s, last session: %s). Refreshing...\n", symbol, lastBar, lastSession)
				if ingestErr := triggerIngestion(symbol); ingestErr != nil {
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

	case "1h":
		// 1시간봉 — candles_1h 테이블에서 그대로 반환. ISO 형식 (lightweight-charts 호환).
		db.Table("candles_1h").
			Select("TO_CHAR(time, 'YYYY-MM-DD\"T\"HH24:MI:SS') as time, open, high, low, close, volume").
			Where("symbol = ?", symbol).
			Order("time ASC").
			Find(&history)

	case "4h":
		// 4시간봉 — 1h 봉을 time_bucket('4 hours') 로 aggregate (TimescaleDB first/last 활용).
		db.Table("candles_1h").
			Select(`
				TO_CHAR(time_bucket('4 hours', time), 'YYYY-MM-DD"T"HH24:MI:SS') as time,
				first(open, time) as open,
				max(high) as high,
				min(low) as low,
				last(close, time) as close,
				sum(volume) as volume
			`).
			Where("symbol = ?", symbol).
			Group("time_bucket('4 hours', time)").
			Order("time ASC").
			Find(&history)
	}

	var companyName string
	_ = db.Table("stocks").Select("name").Where("symbol = ?", symbol).Row().Scan(&companyName)
	if companyName == "" {
		companyName = symbol
	}

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
	var symbols []string

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

	response := make([]StockItem, len(symbols))
	for i, s := range symbols {
		response[i] = StockItem{Symbol: s}
	}

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
