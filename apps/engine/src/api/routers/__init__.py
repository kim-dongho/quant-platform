"""도메인별 라우터 통합."""
from fastapi import APIRouter

from src.api.routers import backtest, live, market, paper, portfolio, stocks

api_router = APIRouter()
api_router.include_router(backtest.router)
api_router.include_router(portfolio.router)
api_router.include_router(paper.router)
api_router.include_router(live.router)
api_router.include_router(market.router)
api_router.include_router(stocks.router)

__all__ = ["api_router"]
