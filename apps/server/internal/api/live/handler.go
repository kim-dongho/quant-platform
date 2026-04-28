// Package live — 라이브 전략 활성화/조회/중지 프록시 핸들러.
package live

import (
	"quant-server/internal/proxy"

	"github.com/gofiber/fiber/v2"
)

// GetLiveStrategy godoc
// @Summary      현재 활성화된 라이브 전략 조회
// @Description  활성 전략이 없으면 null 을 반환합니다.
// @Tags         live
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]string
// @Router       /live/strategy [get]
func GetLiveStrategy(c *fiber.Ctx) error {
	return proxy.Get(c, proxy.EngineBase+"/live/strategy")
}

// UpsertLiveStrategy godoc
// @Summary      라이브 전략 활성화/교체
// @Description  기존 활성 전략이 있으면 자동으로 비활성화하고 새 전략을 활성화합니다. 응답의 replaced 필드에 교체된 전략 정보가 포함됩니다.
// @Tags         live
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "전략 payload (name, universe, clauses, max_positions, exit_policy, position_size_krw)"
// @Success      200      {object}  map[string]interface{}
// @Failure      400      {object}  map[string]string
// @Failure      500      {object}  map[string]string
// @Router       /live/strategy [post]
func UpsertLiveStrategy(c *fiber.Ctx) error {
	return proxy.Post(c, proxy.EngineBase+"/live/strategy")
}

// StopLiveStrategy godoc
// @Summary      라이브 전략 중지
// @Description  현재 활성 전략을 비활성화합니다. 활성 전략이 없으면 stopped=false 를 반환합니다.
// @Tags         live
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]string
// @Router       /live/strategy [delete]
func StopLiveStrategy(c *fiber.Ctx) error {
	return proxy.Delete(c, proxy.EngineBase+"/live/strategy")
}
