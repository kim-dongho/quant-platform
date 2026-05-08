// Package portfolio — 포트폴리오 룰셋 CRUD 및 스크리닝/백테스트/탐색 프록시 핸들러.
package portfolio

import (
	"strconv"
	"time"

	"quant-server/internal/database"
	"quant-server/internal/model"
	"quant-server/internal/proxy"

	"github.com/gofiber/fiber/v2"
)

// ListPortfolioRules godoc
// @Summary      포트폴리오 룰셋 목록 조회
// @Tags         portfolio
// @Produce      json
// @Success      200  {array}  model.PortfolioRule
// @Failure      500  {object} map[string]string
// @Router       /portfolio/rules [get]
func ListPortfolioRules(c *fiber.Ctx) error {
	var rules []model.PortfolioRule
	if err := database.DB.Order("updated_at DESC").Find(&rules).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rules)
}

// CreatePortfolioRule godoc
// @Summary      포트폴리오 룰셋 생성
// @Tags         portfolio
// @Accept       json
// @Produce      json
// @Param        request  body      model.PortfolioRuleRequest  true  "룰셋 payload"
// @Success      200      {object}  model.PortfolioRule
// @Failure      400      {object}  map[string]string
// @Failure      500      {object}  map[string]string
// @Router       /portfolio/rules [post]
func CreatePortfolioRule(c *fiber.Ctx) error {
	req := new(model.PortfolioRuleRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Name == "" || len(req.Config) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "name and config required"})
	}
	rule := model.PortfolioRule{Name: req.Name, Config: req.Config}
	if err := database.DB.Create(&rule).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rule)
}

// UpdatePortfolioRule godoc
// @Summary      포트폴리오 룰셋 수정
// @Tags         portfolio
// @Accept       json
// @Produce      json
// @Param        id       path      int                        true  "Rule ID"
// @Param        request  body      model.PortfolioRuleRequest true  "룰셋 payload"
// @Success      200      {object}  model.PortfolioRule
// @Failure      400      {object}  map[string]string
// @Failure      404      {object}  map[string]string
// @Router       /portfolio/rules/{id} [put]
func UpdatePortfolioRule(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid id"})
	}
	req := new(model.PortfolioRuleRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var rule model.PortfolioRule
	if err := database.DB.First(&rule, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Rule not found"})
	}
	if req.Name != "" {
		rule.Name = req.Name
	}
	if len(req.Config) > 0 {
		rule.Config = req.Config
	}
	if err := database.DB.Save(&rule).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rule)
}

// DeletePortfolioRule godoc
// @Summary      포트폴리오 룰셋 삭제
// @Tags         portfolio
// @Param        id  path  int  true  "Rule ID"
// @Success      204
// @Failure      400  {object}  map[string]string
// @Router       /portfolio/rules/{id} [delete]
func DeletePortfolioRule(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid id"})
	}
	if err := database.DB.Delete(&model.PortfolioRule{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// ScreenPortfolio godoc
// @Summary      포트폴리오 스크리닝 실행 (엔진 프록시)
// @Tags         portfolio
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "Screen request (universe, clauses, max_positions, as_of)"
// @Success      200      {object}  map[string]interface{}
// @Failure      500      {object}  map[string]string
// @Router       /portfolio/screen [post]
func ScreenPortfolio(c *fiber.Ctx) error {
	return proxy.Post(c, proxy.EngineBase+"/portfolio/screen")
}

// BacktestPortfolio godoc
// @Summary      포트폴리오 백테스트 실행 (엔진 프록시)
// @Tags         portfolio
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "Backtest request (universe, clauses, max_positions, start_date, end_date)"
// @Success      200      {object}  map[string]interface{}
// @Failure      500      {object}  map[string]string
// @Router       /portfolio/backtest [post]
func BacktestPortfolio(c *fiber.Ctx) error {
	return proxy.Post(c, proxy.EngineBase+"/portfolio/backtest")
}

// FactorBacktestPortfolio godoc
// @Summary      랭킹 기반 펀더멘털 factor 포트폴리오 백테스트 (엔진 프록시)
// @Description  PBR/PER/ROE/부채비율/영업이익률/총자산회전율 종합 점수 top N% 매수, 분기 리밸런싱.
// @Tags         portfolio
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "Factor backtest request (universe, start_date, end_date, top_pct, rebalance_months)"
// @Success      200      {object}  map[string]interface{}
// @Failure      500      {object}  map[string]string
// @Router       /portfolio/factor-backtest [post]
func FactorBacktestPortfolio(c *fiber.Ctx) error {
	return proxy.Post(c, proxy.EngineBase+"/portfolio/factor-backtest")
}

// DiscoverPortfolio godoc
// @Summary      전략 자동 탐색 (엔진 프록시, 동기)
// @Description  Grid search로 train/test 모두에서 우수한 룰 상위 N개를 반환. n_clauses=2는 수분 소요될 수 있음.
// @Tags         portfolio
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "Discover request"
// @Success      200      {object}  map[string]interface{}
// @Failure      500      {object}  map[string]string
// @Router       /portfolio/discover [post]
func DiscoverPortfolio(c *fiber.Ctx) error {
	// Grid search는 n_clauses=2 시 수분 소요되므로 timeout을 넉넉히.
	return proxy.PostWithTimeout(c, proxy.EngineBase+"/portfolio/discover", 10*time.Minute)
}

// StartDiscover godoc
// @Summary      전략 자동 탐색 시작 (비동기, job_id 반환)
// @Description  background에서 grid search 실행. /portfolio/discover/status/:id로 진행률 polling.
// @Tags         portfolio
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "Discover request (동기 버전과 동일 페이로드)"
// @Success      200      {object}  map[string]interface{}  "{ job_id: string }"
// @Failure      500      {object}  map[string]string
// @Router       /portfolio/discover/start [post]
func StartDiscover(c *fiber.Ctx) error {
	return proxy.Post(c, proxy.EngineBase+"/portfolio/discover/start")
}

// DiscoverStatus godoc
// @Summary      전략 자동 탐색 진행률·결과 조회
// @Description  job_id의 status / done / total / result 반환. 완료 후 30분간 보존.
// @Tags         portfolio
// @Produce      json
// @Param        job_id   path      string  true  "Job ID"
// @Success      200      {object}  map[string]interface{}
// @Failure      404      {object}  map[string]string
// @Router       /portfolio/discover/status/{job_id} [get]
func DiscoverStatus(c *fiber.Ctx) error {
	jobID := c.Params("job_id")
	return proxy.Get(c, proxy.EngineBase+"/portfolio/discover/status/"+jobID)
}

// DiscoverCancel godoc
// @Summary      전략 자동 탐색 취소
// @Description  진행 중인 grid search 에 cancel 요청 — 다음 iteration 진입 시 멈추고 지금까지 결과 반환.
// @Tags         portfolio
// @Produce      json
// @Param        job_id   path      string  true  "Job ID"
// @Success      200      {object}  map[string]interface{}
// @Failure      404      {object}  map[string]string
// @Router       /portfolio/discover/cancel/{job_id} [post]
func DiscoverCancel(c *fiber.Ctx) error {
	jobID := c.Params("job_id")
	return proxy.Post(c, proxy.EngineBase+"/portfolio/discover/cancel/"+jobID)
}
