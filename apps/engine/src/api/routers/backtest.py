"""단일 종목 백테스트 + ad-hoc ingest 라우터."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.api.schemas import BacktestRequest
from src.service.backtest import calculate_strategy
from src.service.ingest import save_to_db

router = APIRouter(tags=["backtest"])


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
        return save_to_db(ticker)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
