package controller

import (
	"quant-server/internal/model"

	"github.com/gofiber/fiber/v2"
)

// RunBacktest godoc
// @Summary      퀀트 백테스트 실행
// @Description  파라미터를 Python 엔진으로 전달하여 백테스트 결과(수익률 곡선 등)를 받아옵니다.
// @Tags         backtest
// @Accept       json
// @Produce      json
// @Param        request  body      model.BacktestRequest  true  "백테스트 설정 (Ticker 및 전략 파라미터)"
// @Success      200      {object}  map[string]interface{} "수익률 데이터 및 날짜 배열"
// @Failure      400      {object}  map[string]string      "Invalid request"
// @Failure      500      {object}  map[string]string      "Engine connection failed"
// @Router       /backtest [post]
func RunBacktest(c *fiber.Ctx) error {
	req := new(model.BacktestRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Python 엔진(FastAPI)으로 전달
	agent := fiber.Post("http://engine:8000/backtest")
	agent.JSON(req)

	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}

	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}
