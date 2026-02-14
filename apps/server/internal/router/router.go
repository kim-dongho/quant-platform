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
}
