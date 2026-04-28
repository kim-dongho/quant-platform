package main

import (
	_ "quant-server/docs"
	"quant-server/internal/api"
	"quant-server/internal/database"

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

	// 라우터 설정 — 도메인별 api 패키지를 모아 /api 그룹에 등록
	api.Setup(app)

	// 서버 실행
	app.Listen(":8080")
}
