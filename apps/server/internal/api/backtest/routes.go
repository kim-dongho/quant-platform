package backtest

import "github.com/gofiber/fiber/v2"

// RegisterRoutes — /backtest 도메인의 모든 라우트를 api 그룹에 등록.
func RegisterRoutes(api fiber.Router) {
	g := api.Group("/backtest")
	g.Post("/", RunBacktest)
}
