package stocks

import "github.com/gofiber/fiber/v2"

// RegisterRoutes — /stocks 도메인의 모든 라우트를 api 그룹에 등록.
func RegisterRoutes(api fiber.Router) {
	g := api.Group("/stocks")
	g.Get("/:symbol/history", GetStockHistory)
	g.Get("/list", GetStockList)
	g.Get("/search", SearchStocks)
}
