// Package paper — KIS API (모의/실전) 잔고/주문/시세 프록시 핸들러.
// ?mode=paper|real 쿼리로 모드 분기. 모든 핸들러가 클라이언트 query string 그대로 전달.
package paper

import (
	"quant-server/internal/proxy"

	"github.com/gofiber/fiber/v2"
)

// withQuery — 클라이언트 query string 을 engine URL 에 그대로 forward.
func withQuery(c *fiber.Ctx, base string) string {
	if qs := string(c.Request().URI().QueryString()); qs != "" {
		return base + "?" + qs
	}
	return base
}

// GetPaperBalance godoc
// @Summary      KIS 계좌 잔고 조회 (mode 별)
// @Description  ?mode=paper|real. 미지정 시 paper.
// @Tags         paper
// @Produce      json
// @Param        mode  query     string  false  "paper | real"
// @Success      200   {object}  map[string]interface{}
// @Failure      400   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /paper/balance [get]
func GetPaperBalance(c *fiber.Ctx) error {
	return proxy.Get(c, withQuery(c, proxy.EngineBase+"/paper/balance"))
}

// PlacePaperOrder godoc
// @Summary      KIS 주문 (mode 별)
// @Description  body: { symbol, qty, side: buy|sell, order_type: market|limit, price? } · ?mode=paper|real
// @Tags         paper
// @Accept       json
// @Produce      json
// @Param        mode     query     string                  false  "paper | real"
// @Param        request  body      map[string]interface{}  true   "주문 payload"
// @Success      200      {object}  map[string]interface{}
// @Failure      400      {object}  map[string]string
// @Failure      500      {object}  map[string]string
// @Router       /paper/orders [post]
func PlacePaperOrder(c *fiber.Ctx) error {
	return proxy.Post(c, withQuery(c, proxy.EngineBase+"/paper/orders"))
}

// GetPaperOrders godoc
// @Summary      KIS 주문/체결 내역 (mode 별)
// @Tags         paper
// @Produce      json
// @Param        mode        query     string  false  "paper | real"
// @Param        start_date  query     string  false  "YYYYMMDD — 생략 시 오늘"
// @Param        end_date    query     string  false  "YYYYMMDD — 생략 시 오늘"
// @Success      200         {array}   map[string]interface{}
// @Failure      400         {object}  map[string]string
// @Failure      500         {object}  map[string]string
// @Router       /paper/orders [get]
func GetPaperOrders(c *fiber.Ctx) error {
	return proxy.Get(c, withQuery(c, proxy.EngineBase+"/paper/orders"))
}

// GetPaperQuote godoc
// @Summary      국내주식 현재가 (mode 별)
// @Tags         paper
// @Produce      json
// @Param        symbol  path      string  true   "6자리 숫자 코드 또는 .KS/.KQ suffix 포함"
// @Param        mode    query     string  false  "paper | real"
// @Success      200     {object}  map[string]interface{}
// @Failure      400     {object}  map[string]string
// @Failure      500     {object}  map[string]string
// @Router       /paper/quote/{symbol} [get]
func GetPaperQuote(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	return proxy.Get(c, withQuery(c, proxy.EngineBase+"/paper/quote/"+symbol))
}
