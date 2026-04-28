"""KIS 모의·실전 계좌 라우터."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from src.api.schemas import PaperOrderRequest
from src.service.kis import KisError, get_kis_client

router = APIRouter(prefix="/paper", tags=["paper"])


@router.get("/balance")
def get_paper_balance():
    """KIS 계좌 잔고 조회."""
    try:
        return get_kis_client().get_balance()
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS balance failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders")
def place_paper_order(req: PaperOrderRequest):
    """현금 주문 (KIS_MODE=paper/real로 분기)."""
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


@router.get("/orders")
def get_paper_orders(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """당일(또는 지정 기간) 주문·체결 내역."""
    try:
        return get_kis_client().get_daily_orders(start_date=start_date, end_date=end_date)
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS orders failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quote/{symbol}")
def get_paper_quote(symbol: str):
    """국내주식 현재가."""
    try:
        return get_kis_client().get_current_price(symbol)
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS quote failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
