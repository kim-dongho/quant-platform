package live

import "github.com/gofiber/fiber/v2"

// RegisterRoutes — /live 도메인의 모든 라우트를 api 그룹에 등록.
func RegisterRoutes(api fiber.Router) {
	g := api.Group("/live")
	g.Get("/strategy", GetLiveStrategy)
	g.Post("/strategy", UpsertLiveStrategy)
	g.Patch("/strategy", PatchLiveStrategy)
	g.Delete("/strategy", StopLiveStrategy)
	g.Get("/strategies", ListLiveStrategies)
	g.Post("/strategies/:id/activate", ActivateLiveStrategy)
	g.Delete("/strategies/:id", DeleteLiveStrategy)
}
