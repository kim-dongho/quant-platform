package main

import (
	"quant-server/internal/router"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	app := fiber.New()

	// 미들웨어 설정
	app.Use(logger.New()) // 로그 기록
	app.Use(cors.New())   // 프론트엔드 접속 허용

	// 라우터 설정
	router.SetupRoutes(app)

	// 서버 실행
	app.Listen(":8080")
}
