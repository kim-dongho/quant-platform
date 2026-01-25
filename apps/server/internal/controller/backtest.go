package controller

import (
	"quant-server/internal/model"

	"github.com/gofiber/fiber/v2"
)

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
