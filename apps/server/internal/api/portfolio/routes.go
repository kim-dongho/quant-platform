package portfolio

import "github.com/gofiber/fiber/v2"

// RegisterRoutes — /portfolio 도메인의 모든 라우트를 api 그룹에 등록.
func RegisterRoutes(api fiber.Router) {
	g := api.Group("/portfolio")
	g.Get("/rules", ListPortfolioRules)
	g.Post("/rules", CreatePortfolioRule)
	g.Put("/rules/:id", UpdatePortfolioRule)
	g.Delete("/rules/:id", DeletePortfolioRule)
	g.Post("/screen", ScreenPortfolio)
	g.Post("/backtest", BacktestPortfolio)
	g.Post("/factor-backtest", FactorBacktestPortfolio)
	g.Post("/discover", DiscoverPortfolio)
	g.Post("/discover/start", StartDiscover)
	g.Get("/discover/status/:job_id", DiscoverStatus)
	g.Post("/discover/cancel/:job_id", DiscoverCancel)
	g.Get("/discover/runs", ListDiscoverRuns)
	g.Get("/discover/runs/:id", GetDiscoverRun)
	g.Delete("/discover/runs/:id", DeleteDiscoverRun)
}
