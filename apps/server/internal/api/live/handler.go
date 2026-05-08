// Package live — 라이브 전략 활성화/조회/중지 프록시 핸들러.
package live

import (
	"quant-server/internal/proxy"

	"github.com/gofiber/fiber/v2"
)

// withMode — query string 의 ?mode=... 를 engine URL 에 그대로 전달.
// paper / real 분리 운영 시 클라이언트가 mode 를 query 로 명시.
func withMode(c *fiber.Ctx, base string) string {
	mode := c.Query("mode")
	if mode == "" {
		return base
	}
	return base + "?mode=" + mode
}

// GetLiveStrategy godoc
// @Summary      활성 라이브 전략 조회 (mode 별)
// @Description  ?mode=paper / real 로 mode 지정. 활성 전략 없으면 null.
// @Tags         live
// @Produce      json
// @Param        mode  query     string  false  "paper | real (기본 paper)"
// @Success      200   {object}  map[string]interface{}
// @Failure      500   {object}  map[string]string
// @Router       /live/strategy [get]
func GetLiveStrategy(c *fiber.Ctx) error {
	return proxy.Get(c, withMode(c, proxy.EngineBase+"/live/strategy"))
}

// GetActiveLiveStrategies godoc
// @Summary      활성 라이브 전략 모두 (paper / real)
// @Tags         live
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Failure      500  {object}  map[string]string
// @Router       /live/strategies/active [get]
func GetActiveLiveStrategies(c *fiber.Ctx) error {
	return proxy.Get(c, proxy.EngineBase+"/live/strategies/active")
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

// PatchLiveStrategy godoc
// @Summary      활성 전략의 종목당 배분 금액만 수정
// @Description  룰·청산 정책은 그대로 두고 position_size_krw 만 변경. 0 이하 → 자본 균등 분배 모드.
// @Tags         live
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "{ position_size_krw: number }"
// @Success      200      {object}  map[string]interface{}
// @Failure      404      {object}  map[string]string
// @Failure      500      {object}  map[string]string
// @Router       /live/strategy [patch]
func PatchLiveStrategy(c *fiber.Ctx) error {
	return proxy.Patch(c, proxy.EngineBase+"/live/strategy")
}

// StopLiveStrategy godoc
// @Summary      라이브 전략 중지 (mode 별)
// @Description  ?mode=paper / real 로 mode 지정. 활성 전략 없으면 stopped=false.
// @Tags         live
// @Produce      json
// @Param        mode  query     string  false  "paper | real (기본 paper)"
// @Success      200   {object}  map[string]interface{}
// @Failure      500   {object}  map[string]string
// @Router       /live/strategy [delete]
func StopLiveStrategy(c *fiber.Ctx) error {
	return proxy.Delete(c, withMode(c, proxy.EngineBase+"/live/strategy"))
}

// ListLiveStrategies godoc
// @Summary      저장된 라이브 전략 전체 목록
// @Description  활성 1개 + 비활성 N개를 활성·최근수정 순으로 반환합니다.
// @Tags         live
// @Produce      json
// @Success      200  {array}   map[string]interface{}
// @Failure      500  {object}  map[string]string
// @Router       /live/strategies [get]
func ListLiveStrategies(c *fiber.Ctx) error {
	return proxy.Get(c, proxy.EngineBase+"/live/strategies")
}

// ActivateLiveStrategy godoc
// @Summary      저장된 라이브 전략 활성화
// @Description  지정 ID 전략을 활성화. 기존 활성 전략은 자동으로 비활성화됩니다.
// @Tags         live
// @Produce      json
// @Param        id   path      int  true  "Strategy ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /live/strategies/{id}/activate [post]
func ActivateLiveStrategy(c *fiber.Ctx) error {
	id := c.Params("id")
	return proxy.Post(c, proxy.EngineBase+"/live/strategies/"+id+"/activate")
}

// DeleteLiveStrategy godoc
// @Summary      비활성 라이브 전략 삭제
// @Description  활성 전략은 삭제 불가. 먼저 다른 전략으로 전환한 뒤 삭제하세요.
// @Tags         live
// @Produce      json
// @Param        id   path      int  true  "Strategy ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]string  "활성 전략은 삭제 불가"
// @Failure      404  {object}  map[string]string
// @Router       /live/strategies/{id} [delete]
func DeleteLiveStrategy(c *fiber.Ctx) error {
	id := c.Params("id")
	return proxy.Delete(c, proxy.EngineBase+"/live/strategies/"+id)
}

// GetLiveRealizedPnL godoc
// @Summary      활성 전략의 누적 실현손익 + 청산 거래 리스트 (mode 별)
// @Description  ?mode=paper / real 로 mode 지정.
// @Tags         live
// @Produce      json
// @Param        mode  query     string  false  "paper | real (기본 paper)"
// @Success      200   {object}  map[string]interface{}
// @Failure      500   {object}  map[string]string
// @Router       /live/realized-pnl [get]
func GetLiveRealizedPnL(c *fiber.Ctx) error {
	return proxy.Get(c, withMode(c, proxy.EngineBase+"/live/realized-pnl"))
}
