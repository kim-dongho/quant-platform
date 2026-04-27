from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.service.backtest import calculate_strategy
from src.service.ingest import save_to_db
from src.service.market_calendar import get_last_session_date
from src.service.kis_client import KisError, get_kis_client
from src.service.live_strategy import (
    get_active_strategy,
    stop_active_strategy,
    upsert_active_strategy,
)
from src.service.portfolio_backtest import run_portfolio_backtest
from src.service.screener import ScreenError, run_screen
from typing import Dict, Any, List, Literal, Optional

router = APIRouter()

# 요청 데이터 모델
class BacktestRequest(BaseModel):
    ticker: str
    # 특정 지표에 종속되지 않도록 딕셔너리 형태로 통합
    params: Dict[str, Any] = {
        "short_window": 5,
        "long_window": 20
    }

@router.post("/backtest")
def run_backtest_api(req: BacktestRequest):
    print(f"🚀 Running backtest for {req.ticker} with params: {req.params}")

    result = calculate_strategy(req.ticker, req.params)

    if result is None:
        return {"error": "Backtest failed or no data available"}

    return result

@router.post("/ingest/{ticker}")
def ingest_data_api(ticker: str):
    print(f"📥 Starting ingestion for: {ticker}")

    try:
        # Service Layer 호출
        result = save_to_db(ticker)
        return result

    except ValueError as e:
        # Yahoo Finance에 없는 종목 등
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # 기타 서버 에러
        print(f"❌ Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ScreenClause(BaseModel):
    factor: str
    op: str
    value: float


class ScreenRequest(BaseModel):
    universe: str = "sp500"
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    as_of: Optional[str] = None


@router.post("/portfolio/screen")
def screen_portfolio(req: ScreenRequest):
    try:
        return run_screen(
            universe=req.universe,
            clauses=[c.model_dump() for c in req.clauses],
            max_positions=req.max_positions,
            as_of=req.as_of,
        )
    except ScreenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Screen failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ExitPolicyModel(BaseModel):
    """청산 정책 — 모든 필드는 선택적이며 OR 결합으로 평가."""
    stop_loss_pct: Optional[float] = None        # 예: -5.0 (-5%)
    take_profit_pct: Optional[float] = None      # 예: 10.0 (+10%)
    trailing_stop_pct: Optional[float] = None    # 예: -8.0 (최고가 대비 -8%)
    time_exit_days: Optional[int] = None         # 보유 달력일 상한
    signal_exit_clauses: List[ScreenClause] = []


class PortfolioBacktestRequest(BaseModel):
    universe: str = "sp500"
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    exit_policy: Optional[ExitPolicyModel] = None


@router.post("/portfolio/backtest")
def portfolio_backtest_api(req: PortfolioBacktestRequest):
    try:
        exit_policy_dict = None
        if req.exit_policy is not None:
            p = req.exit_policy
            exit_policy_dict = {
                "stop_loss_pct": p.stop_loss_pct,
                "take_profit_pct": p.take_profit_pct,
                "trailing_stop_pct": p.trailing_stop_pct,
                "time_exit_days": p.time_exit_days,
                "signal_exit_clauses": [c.model_dump() for c in p.signal_exit_clauses],
            }
        return run_portfolio_backtest(
            universe=req.universe,
            clauses=[c.model_dump() for c in req.clauses],
            max_positions=req.max_positions,
            start_date=req.start_date,
            end_date=req.end_date,
            exit_policy=exit_policy_dict,
        )
    except ScreenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Portfolio backtest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/paper/balance")
def get_paper_balance():
    """모의/실전 KIS 계좌 잔고 조회. KIS_MODE 환경변수로 분기."""
    try:
        return get_kis_client().get_balance()
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS balance failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class PaperOrderRequest(BaseModel):
    symbol: str
    qty: int
    side: str  # 'buy' | 'sell'
    order_type: str = "market"  # 'market' | 'limit'
    price: Optional[float] = None


@router.post("/paper/orders")
def place_paper_order(req: PaperOrderRequest):
    """KIS Open API로 현금 주문을 전송한다. 모의/실전은 KIS_MODE로 결정."""
    try:
        return get_kis_client().place_order(
            symbol=req.symbol,
            qty=req.qty,
            side=req.side,
            order_type=req.order_type,
            price=req.price,
        )
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS order failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/paper/orders")
def get_paper_orders(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """당일(또는 지정 기간) 주문·체결 내역."""
    try:
        return get_kis_client().get_daily_orders(start_date=start_date, end_date=end_date)
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS orders failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/paper/quote/{symbol}")
def get_paper_quote(symbol: str):
    """국내주식 현재가(호가·전일대비·거래량)."""
    try:
        return get_kis_client().get_current_price(symbol)
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS quote failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class LiveStrategyRequest(BaseModel):
    """라이브 전략 upsert 요청.

    clauses/exit_policy 구조는 /portfolio/backtest 와 동일해서 그쪽 모델 재사용.
    """
    name: str = "기본 전략"
    universe: str
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    exit_policy: Optional[ExitPolicyModel] = None
    position_size_krw: int = 1_000_000
    mode: Literal["paper"] = "paper"


def _exit_policy_to_dict(p: Optional[ExitPolicyModel]) -> Optional[Dict[str, Any]]:
    if p is None:
        return None
    return {
        "stop_loss_pct": p.stop_loss_pct,
        "take_profit_pct": p.take_profit_pct,
        "trailing_stop_pct": p.trailing_stop_pct,
        "time_exit_days": p.time_exit_days,
        "signal_exit_clauses": [c.model_dump() for c in p.signal_exit_clauses],
    }


@router.get("/live/strategy")
def get_live_strategy():
    """현재 활성화된 라이브 전략 1개를 반환. 없으면 null."""
    try:
        return get_active_strategy()
    except Exception as e:
        print(f"❌ get_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/live/strategy")
def upsert_live_strategy(req: LiveStrategyRequest):
    """라이브 전략을 활성화. 기존 활성 전략이 있으면 자동으로 교체."""
    try:
        payload = {
            "name": req.name,
            "universe": req.universe,
            "clauses": [c.model_dump() for c in req.clauses],
            "max_positions": req.max_positions,
            "exit_policy": _exit_policy_to_dict(req.exit_policy),
            "position_size_krw": req.position_size_krw,
            "mode": req.mode,
        }
        return upsert_active_strategy(payload)
    except Exception as e:
        print(f"❌ upsert_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/live/strategy")
def delete_live_strategy():
    """현재 활성 전략을 중지."""
    try:
        return stop_active_strategy()
    except Exception as e:
        print(f"❌ stop_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/last_session")
def get_last_session(market: str = "NASDAQ"):
    """
    가장 최근에 마감된 거래 세션 날짜를 반환.
    Go 서버가 DB 데이터의 stale 여부를 판단할 때 사용.
    """
    try:
        return {"market": market, "date": get_last_session_date(market)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/list")
def get_stock_list():
    """
    DB에 저장된 모든 종목의 티커와 이름을 가져옵니다.
    중복을 제거하고(DISTINCT), 티커 순으로 정렬합니다.
    """
    # market_data 테이블에서 symbol만 가져오거나,
    # 별도의 company_info 테이블이 있다면 거기서 가져오는 것이 더 효율적입니다.
    # 여기서는 market_data에서 유니크한 값을 뽑는 예시입니다.
    query = """
        SELECT DISTINCT symbol
        FROM market_data
        ORDER BY symbol ASC
    """
    try:
        df = pd.read_sql(query, engine)
        # 프론트엔드에서 쓰기 편하게 리스트 형태로 변환
        # 예: [{'symbol': 'AAPL'}, {'symbol': 'NVDA'}, ...]
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}
