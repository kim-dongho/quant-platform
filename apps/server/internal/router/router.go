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
	stocks.Get("/:symbol/intraday", controller.GetIntradayCandles)
	stocks.Get("/list", controller.GetStockList)

	// 포트폴리오(유니버스 스크리닝) 관련 경로
	portfolio := api.Group("/portfolio")
	portfolio.Get("/rules", controller.ListPortfolioRules)
	portfolio.Post("/rules", controller.CreatePortfolioRule)
	portfolio.Put("/rules/:id", controller.UpdatePortfolioRule)
	portfolio.Delete("/rules/:id", controller.DeletePortfolioRule)
	portfolio.Post("/screen", controller.ScreenPortfolio)
	portfolio.Post("/backtest", controller.BacktestPortfolio)
	portfolio.Post("/ingest_universe", controller.IngestUniverse)
	portfolio.Get("/ingest_status", controller.GetIngestStatus)
}
