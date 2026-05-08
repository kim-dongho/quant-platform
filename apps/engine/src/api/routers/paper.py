"""KIS 모의·실전 계좌 라우터.

엔드포인트 prefix 는 /paper 그대로지만, ?mode=paper|real 쿼리로 모드 분기.
mode 미지정 시 paper 가 기본 (구 동작 유지).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from src.api.schemas import PaperOrderRequest
from src.service.kis import KisError, get_kis_client

router = APIRouter(prefix="/paper", tags=["paper"])


@router.get("/balance")
def get_paper_balance(mode: str = "paper"):
    """KIS 계좌 잔고 조회 (mode 별)."""
    try:
        return get_kis_client(mode=mode).get_balance()
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS balance failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders")
def place_paper_order(req: PaperOrderRequest, mode: str = "paper"):
    """현금 주문 (mode=paper|real)."""
    try:
        return get_kis_client(mode=mode).place_order(
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
def get_paper_orders(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    mode: str = "paper",
):
    """당일(또는 지정 기간) 주문·체결 내역 (mode 별)."""
    try:
        return get_kis_client(mode=mode).get_daily_orders(start_date=start_date, end_date=end_date)
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS orders failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quote/{symbol}")
def get_paper_quote(symbol: str, mode: str = "paper"):
    """국내주식 현재가 (mode 별 — 시세는 양쪽 같지만 토큰 발급 분리)."""
    try:
        return get_kis_client(mode=mode).get_current_price(symbol)
    except KisError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ KIS quote failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
