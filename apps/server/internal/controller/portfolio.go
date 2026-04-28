package controller

import (
	"strconv"
	"time"

	"quant-server/internal/database"
	"quant-server/internal/model"

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
	return proxyToEngine(c, "http://engine:8000/portfolio/screen")
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
	return proxyToEngine(c, "http://engine:8000/portfolio/backtest")
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
	return proxyToEngineWithTimeout(c, "http://engine:8000/portfolio/discover", 10*time.Minute)
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
	return proxyToEngine(c, "http://engine:8000/portfolio/discover/start")
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
	url := "http://engine:8000/portfolio/discover/status/" + jobID
	agent := fiber.Get(url)
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}

func proxyToEngine(c *fiber.Ctx, url string) error {
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

func proxyToEngineWithTimeout(c *fiber.Ctx, url string, timeout time.Duration) error {
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
