import threading
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from src.core.config import UNIVERSE_NAMES, get_universe
from src.service.backtest import calculate_strategy
from src.service.ingest import save_to_db
from src.service.ingest_1m import save_1m_to_db
from src.service.market_calendar import get_last_session_date
from src.service.portfolio_backtest import run_portfolio_backtest
from src.service.screener import ScreenError, run_screen
from typing import Dict, Any, List, Optional

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


@router.post("/ingest_1m/{ticker}")
def ingest_1m_data(ticker: str):
    try:
        save_1m_to_db(ticker)
        return {"status": "success", "message": f"1m data for {ticker} saved"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class ScreenClause(BaseModel):
    factor: str
    op: str
    value: float


class ScreenRequest(BaseModel):
    universe: str = "sp500"
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    as_of: Optional[str] = None


# 유니버스별 수집 진행 상태 (프론트 폴링용)
_ingestion_state: Dict[str, Dict[str, Any]] = {}
_ingestion_lock = threading.Lock()


def _ingest_universe_worker(universe: str, symbols: List[str]):
    print(f"🌐 [universe={universe}] ingest start, {len(symbols)} tickers")
    total = len(symbols)
    succeeded = 0
    failed = 0

    for i, ticker in enumerate(symbols):
        with _ingestion_lock:
            _ingestion_state[universe]["current"] = ticker
        try:
            save_to_db(ticker)
            succeeded += 1
        except Exception as e:
            failed += 1
            print(f"⚠️ [{universe}] {ticker} failed: {e}")
        with _ingestion_lock:
            _ingestion_state[universe].update(
                {"completed": i + 1, "succeeded": succeeded, "failed": failed}
            )
        time.sleep(1.2)  # yfinance rate limit 완화

    print(f"✅ [universe={universe}] ingest done: {succeeded}/{total} ({failed} failed)")
    with _ingestion_lock:
        _ingestion_state[universe].update(
            {"status": "done", "current": None, "finished_at": time.time()}
        )


@router.post("/portfolio/ingest_universe")
def ingest_universe(universe: str = "sp500"):
    """
    유니버스 전체를 백그라운드 스레드로 수집. 즉시 202 반환.
    진행 상황은 GET /portfolio/ingest_status 로 폴링.
    """
    if universe == "all":
        raise HTTPException(
            status_code=400,
            detail="'all' universe cannot be ingested via API. Use ./scripts/ingest-universe.sh from host.",
        )
    if universe not in UNIVERSE_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown universe: {universe}. Allowed: {sorted(UNIVERSE_NAMES)}",
        )

    try:
        symbols = list(dict.fromkeys(get_universe(universe)))  # dedupe, 순서 보존
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load universe: {e}")

    with _ingestion_lock:
        existing = _ingestion_state.get(universe)
        if existing and existing.get("status") == "running":
            return JSONResponse(
                status_code=409,
                content={"status": "already_running", "universe": universe, "count": len(symbols)},
            )
        _ingestion_state[universe] = {
            "status": "running",
            "total": len(symbols),
            "completed": 0,
            "succeeded": 0,
            "failed": 0,
            "current": None,
            "started_at": time.time(),
            "finished_at": None,
        }

    threading.Thread(
        target=_ingest_universe_worker, args=(universe, symbols), daemon=True
    ).start()

    return JSONResponse(
        status_code=202,
        content={"status": "started", "universe": universe, "count": len(symbols)},
    )


@router.get("/portfolio/ingest_status")
def get_ingest_status(universe: str = "sp500"):
    """현재 수집 진행 상태 반환. 한 번도 안 돌렸으면 status='idle'."""
    with _ingestion_lock:
        state = _ingestion_state.get(universe)
    if state is None:
        return {"universe": universe, "status": "idle"}
    return {"universe": universe, **state}


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


class PortfolioBacktestRequest(BaseModel):
    universe: str = "sp500"
    clauses: List[ScreenClause] = []
    max_positions: int = 10
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@router.post("/portfolio/backtest")
def portfolio_backtest_api(req: PortfolioBacktestRequest):
    try:
        return run_portfolio_backtest(
            universe=req.universe,
            clauses=[c.model_dump() for c in req.clauses],
            max_positions=req.max_positions,
            start_date=req.start_date,
            end_date=req.end_date,
        )
    except ScreenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Portfolio backtest failed: {e}")
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