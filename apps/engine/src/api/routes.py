from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.service.backtest import calculate_strategy
from src.service.ingest import save_to_db
from typing import Dict, Any, Optional

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