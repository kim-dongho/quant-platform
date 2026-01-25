package main

import (
	_ "quant-server/docs"
	"quant-server/internal/database"
	"quant-server/internal/router"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/swagger"
)

// @title           Quant Trading API
// @version         1.0
// @description     Go + Python 퀀트 플랫폼 API 서버입니다.
// @host            localhost:8080
// @BasePath        /api
func main() {
	app := fiber.New()

	// 미들웨어 설정
	app.Use(logger.New()) // 로그 기록
	app.Use(cors.New())   // 프론트엔드 접속 허용

	database.ConnectDB()

	app.Get("/swagger/*", swagger.HandlerDefault)

	// 라우터 설정
	router.SetupRoutes(app)

	// 서버 실행
	app.Listen(":8080")
}
