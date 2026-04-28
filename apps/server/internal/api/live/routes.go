package live

import "github.com/gofiber/fiber/v2"

// RegisterRoutes — /live 도메인의 모든 라우트를 api 그룹에 등록.
func RegisterRoutes(api fiber.Router) {
	g := api.Group("/live")
	g.Get("/strategy", GetLiveStrategy)
	g.Post("/strategy", UpsertLiveStrategy)
	g.Delete("/strategy", StopLiveStrategy)
}
