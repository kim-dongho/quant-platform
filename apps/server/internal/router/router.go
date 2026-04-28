package router

import (
	"quant-server/internal/controller"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// 백테스팅 관련 경로
	backtest := api.Group("/backtest")
	backtest.Post("/", controller.RunBacktest)

	// 주식 관련 경로
	stocks := api.Group("/stocks")
	stocks.Get("/:symbol/history", controller.GetStockHistory)
	stocks.Get("/list", controller.GetStockList)
	stocks.Get("/search", controller.SearchStocks)

	// 포트폴리오(유니버스 스크리닝) 관련 경로
	portfolio := api.Group("/portfolio")
	portfolio.Get("/rules", controller.ListPortfolioRules)
	portfolio.Post("/rules", controller.CreatePortfolioRule)
	portfolio.Put("/rules/:id", controller.UpdatePortfolioRule)
	portfolio.Delete("/rules/:id", controller.DeletePortfolioRule)
	portfolio.Post("/screen", controller.ScreenPortfolio)
	portfolio.Post("/backtest", controller.BacktestPortfolio)
	portfolio.Post("/discover", controller.DiscoverPortfolio)
	portfolio.Post("/discover/start", controller.StartDiscover)
	portfolio.Get("/discover/status/:job_id", controller.DiscoverStatus)

	// 모의투자(Paper Trade) — KIS Open API 프록시
	paper := api.Group("/paper")
	paper.Get("/balance", controller.GetPaperBalance)
	paper.Post("/orders", controller.PlacePaperOrder)
	paper.Get("/orders", controller.GetPaperOrders)
	paper.Get("/quote/:symbol", controller.GetPaperQuote)

	// 라이브 전략 (전략 페이지에서 활성화된 룰을 모의계좌 위에 엮음)
	live := api.Group("/live")
	live.Get("/strategy", controller.GetLiveStrategy)
	live.Post("/strategy", controller.UpsertLiveStrategy)
	live.Delete("/strategy", controller.StopLiveStrategy)
}
