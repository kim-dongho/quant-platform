"""시장 일정 라우터."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.service.market import get_last_session_date

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/last_session")
def get_last_session(market: str = "NASDAQ"):
    """가장 최근에 마감된 거래 세션 날짜를 반환. Go 서버가 데이터 stale 판단에 사용."""
    try:
        return {"market": market, "date": get_last_session_date(market)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
