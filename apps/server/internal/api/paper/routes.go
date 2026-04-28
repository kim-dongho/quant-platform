package paper

import "github.com/gofiber/fiber/v2"

// RegisterRoutes — /paper 도메인의 모든 라우트를 api 그룹에 등록.
func RegisterRoutes(api fiber.Router) {
	g := api.Group("/paper")
	g.Get("/balance", GetPaperBalance)
	g.Post("/orders", PlacePaperOrder)
	g.Get("/orders", GetPaperOrders)
	g.Get("/quote/:symbol", GetPaperQuote)
}
