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

	// 나중에 추가될 수 있는 경로 (예: 모의투자)
	// mock := api.Group("/mock")
	// mock.Post("/order", controllers.PlaceOrder)
}
