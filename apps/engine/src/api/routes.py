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