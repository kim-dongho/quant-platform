"""종목 메타 정보 라우터."""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from src.core.database import engine

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/list")
def get_stock_list():
    """DB에 저장된 모든 종목의 티커. DISTINCT, 티커 순."""
    query = """
        SELECT DISTINCT symbol
        FROM market_data
        ORDER BY symbol ASC
    """
    try:
        df = pd.read_sql(query, engine)
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}
