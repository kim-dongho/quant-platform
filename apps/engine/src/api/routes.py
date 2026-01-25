from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.service.backtest import calculate_strategy
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
    
    # calculate_strategy(ticker, params) 구조에 맞게 호출
    result = calculate_strategy(req.ticker, req.params)
    
    if result is None:
        return {"error": "Backtest failed or no data available"}
        
    return result

    