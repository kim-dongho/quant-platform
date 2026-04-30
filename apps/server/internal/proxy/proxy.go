// Package proxy — Python 엔진(FastAPI) 호출용 fiber agent 헬퍼.
//
// 모든 엔진 프록시 호출을 한 곳에서 관리해 도메인 핸들러는 URL 만 알아도 되도록.
package proxy

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

// EngineBase — Python 엔진 컨테이너 base URL.
const EngineBase = "http://engine:8000"

// Get — GET 요청 프록시. 클라이언트 query string 은 호출 측에서 url 에 직접 붙여 전달.
func Get(c *fiber.Ctx, url string) error {
	agent := fiber.Get(url)
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}

// Post — JSON body 그대로 전달.
func Post(c *fiber.Ctx, url string) error {
	agent := fiber.Post(url)
	agent.Body(c.Body())
	agent.Set("Content-Type", "application/json")
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}

// PostWithTimeout — 긴 작업(grid search 등)용. Timeout 명시적 지정.
func PostWithTimeout(c *fiber.Ctx, url string, timeout time.Duration) error {
	agent := fiber.Post(url)
	agent.Body(c.Body())
	agent.Set("Content-Type", "application/json")
	agent.Timeout(timeout)
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}

// Delete — DELETE 요청 프록시.
func Delete(c *fiber.Ctx, url string) error {
	agent := fiber.Delete(url)
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}

// Patch — PATCH JSON body 그대로 전달.
func Patch(c *fiber.Ctx, url string) error {
	agent := fiber.Patch(url)
	agent.Body(c.Body())
	agent.Set("Content-Type", "application/json")
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}
