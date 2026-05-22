"""API 전반에 공유되는 Pydantic 모델."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


class ScreenClause(BaseModel):
    factor: str
    op: str
    value: float


class ExitPolicyModel(BaseModel):
    """청산 정책 — 모든 필드는 선택적이며 OR 결합으로 평가."""

    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None
    trailing_stop_pct: Optional[float] = None
    time_exit_days: Optional[int] = None
    signal_exit_clauses: List[ScreenClause] = []


# ─── 백테스트 / 스크리닝 ────────────────────────────────────
class BacktestRequest(BaseModel):
    ticker: str
    params: Dict[str, Any] = {"short_window": 5, "long_window": 20}


class ScreenRequest(BaseModel):
    universe: str = "sp500"
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    as_of: Optional[str] = None


class PortfolioBacktestRequest(BaseModel):
    universe: str = "sp500"
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    exit_policy: Optional[ExitPolicyModel] = None


class DiscoverRequest(BaseModel):
    """전략 자동 탐색 요청. 모든 필드는 선택적이며, 비워두면 합리적 디폴트가 적용됨."""

    universe: str = "krx350"
    factors: Optional[List[str]] = None
    ops: Optional[List[str]] = None
    percentiles: Optional[List[float]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    train_ratio: float = 0.7
    max_positions: int = 10
    n_clauses: Literal[1, 2] = 1
    top_n: int = 5
    exit_policy: Optional[ExitPolicyModel] = None
    use_walkforward: bool = True
    wf_window_months: int = 24
    wf_step_months: int = 6
    wf_top_n_candidates: int = 30


class FactorPortfolioBacktestRequest(BaseModel):
    """랭킹 기반 펀더멘털 factor 포트폴리오 백테스트 요청."""

    universe: str = "kospi200"
    start_date: str = "2020-01-01"
    end_date: Optional[str] = None
    top_pct: float = 0.20
    rebalance_months: int = 3
    min_stocks: int = 5
    factor_dirs: Optional[Dict[str, int]] = None  # 비우면 기본 6 factor


# ─── 모의계좌 ───────────────────────────────────────────────
class PaperOrderRequest(BaseModel):
    symbol: str
    qty: int
    side: str  # 'buy' | 'sell'
    order_type: str = "market"  # 'market' | 'limit'
    price: Optional[float] = None


# ─── 라이브 전략 ────────────────────────────────────────────
class LiveStrategyRequest(BaseModel):
    name: str = "기본 전략"
    universe: str
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    exit_policy: Optional[ExitPolicyModel] = None
    position_size_krw: int = 1_000_000
    mode: Literal["paper", "real"] = "paper"
