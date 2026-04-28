// Package api — 도메인 패키지들의 라우트를 모아 /api 그룹에 마운트.
package api

import (
	"quant-server/internal/api/backtest"
	"quant-server/internal/api/live"
	"quant-server/internal/api/paper"
	"quant-server/internal/api/portfolio"
	"quant-server/internal/api/stocks"

	"github.com/gofiber/fiber/v2"
)

// Setup — /api 그룹 생성 후 각 도메인 RegisterRoutes 호출.
func Setup(app *fiber.App) {
	g := app.Group("/api")

	backtest.RegisterRoutes(g)
	stocks.RegisterRoutes(g)
	portfolio.RegisterRoutes(g)
	paper.RegisterRoutes(g)
	live.RegisterRoutes(g)
}
