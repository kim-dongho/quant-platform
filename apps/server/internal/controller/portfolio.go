package controller

import (
	"strconv"

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

// GetIngestStatus godoc
// @Summary      유니버스 수집 진행 상태 조회 (엔진 프록시)
// @Tags         portfolio
// @Produce      json
// @Param        universe  query     string  false  "Universe name (default: sp500)"
// @Success      200       {object}  map[string]interface{}
// @Router       /portfolio/ingest_status [get]
func GetIngestStatus(c *fiber.Ctx) error {
	universe := c.Query("universe", "sp500")
	url := "http://engine:8000/portfolio/ingest_status?universe=" + universe

	agent := fiber.Get(url)
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}

// IngestUniverse godoc
// @Summary      유니버스 전체 데이터 수집 트리거 (엔진 프록시)
// @Description  지정한 universe에 속한 모든 종목의 일봉/팩터를 백그라운드로 수집. 즉시 202 반환.
// @Tags         portfolio
// @Produce      json
// @Param        universe  query     string  false  "Universe name (default: sp500)"
// @Success      202       {object}  map[string]interface{}
// @Failure      400       {object}  map[string]string
// @Failure      409       {object}  map[string]interface{}
// @Router       /portfolio/ingest_universe [post]
func IngestUniverse(c *fiber.Ctx) error {
	universe := c.Query("universe", "sp500")
	url := "http://engine:8000/portfolio/ingest_universe?universe=" + universe

	agent := fiber.Post(url)
	status, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Engine connection failed"})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
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
