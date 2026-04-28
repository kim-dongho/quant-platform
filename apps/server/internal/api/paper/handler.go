// Package paper — 모의투자(KIS API) 잔고/주문/시세 프록시 핸들러.
package paper

import (
	"quant-server/internal/proxy"

	"github.com/gofiber/fiber/v2"
)

// GetPaperBalance godoc
// @Summary      모의투자 계좌 잔고 조회 (KIS API 엔진 프록시)
// @Description  KIS Open API로 잔고와 보유종목을 조회합니다. 모의/실전 분기는 엔진의 KIS_MODE 환경변수가 결정합니다.
// @Tags         paper
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /paper/balance [get]
func GetPaperBalance(c *fiber.Ctx) error {
	return proxy.Get(c, proxy.EngineBase+"/paper/balance")
}

// PlacePaperOrder godoc
// @Summary      모의투자 주문 (KIS API 엔진 프록시)
// @Description  { symbol, qty, side: buy|sell, order_type: market|limit, price? }
// @Tags         paper
// @Accept       json
// @Produce      json
// @Param        request  body      map[string]interface{}  true  "주문 payload"
// @Success      200      {object}  map[string]interface{}
// @Failure      400      {object}  map[string]string
// @Failure      500      {object}  map[string]string
// @Router       /paper/orders [post]
func PlacePaperOrder(c *fiber.Ctx) error {
	return proxy.Post(c, proxy.EngineBase+"/paper/orders")
}

// GetPaperOrders godoc
// @Summary      모의투자 주문/체결 내역 (KIS API 엔진 프록시)
// @Tags         paper
// @Produce      json
// @Param        start_date  query     string  false  "YYYYMMDD — 생략 시 오늘"
// @Param        end_date    query     string  false  "YYYYMMDD — 생략 시 오늘"
// @Success      200         {array}   map[string]interface{}
// @Failure      400         {object}  map[string]string
// @Failure      500         {object}  map[string]string
// @Router       /paper/orders [get]
func GetPaperOrders(c *fiber.Ctx) error {
	url := proxy.EngineBase + "/paper/orders"
	if qs := string(c.Request().URI().QueryString()); qs != "" {
		url = url + "?" + qs
	}
	return proxy.Get(c, url)
}

// GetPaperQuote godoc
// @Summary      국내주식 현재가 (KIS API 엔진 프록시)
// @Tags         paper
// @Produce      json
// @Param        symbol  path      string  true  "6자리 숫자 코드 또는 .KS/.KQ suffix 포함"
// @Success      200     {object}  map[string]interface{}
// @Failure      400     {object}  map[string]string
// @Failure      500     {object}  map[string]string
// @Router       /paper/quote/{symbol} [get]
func GetPaperQuote(c *fiber.Ctx) error {
	symbol := c.Params("symbol")
	return proxy.Get(c, proxy.EngineBase+"/paper/quote/"+symbol)
}
