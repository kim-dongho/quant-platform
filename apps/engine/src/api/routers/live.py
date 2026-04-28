"""라이브 전략 (활성 1개) CRUD 라우터."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.api.deps import exit_policy_to_dict
from src.api.schemas import LiveStrategyRequest
from src.service.live import (
    get_active_strategy,
    stop_active_strategy,
    upsert_active_strategy,
)

router = APIRouter(prefix="/live", tags=["live"])


@router.get("/strategy")
def get_live_strategy():
    """현재 활성화된 라이브 전략 1개를 반환. 없으면 null."""
    try:
        return get_active_strategy()
    except Exception as e:
        print(f"❌ get_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/strategy")
def upsert_live_strategy(req: LiveStrategyRequest):
    """라이브 전략을 활성화. 기존 활성 전략이 있으면 자동으로 교체."""
    try:
        payload = {
            "name": req.name,
            "universe": req.universe,
            "clauses": [c.model_dump() for c in req.clauses],
            "max_positions": req.max_positions,
            "exit_policy": exit_policy_to_dict(req.exit_policy),
            "position_size_krw": req.position_size_krw,
            "mode": req.mode,
        }
        return upsert_active_strategy(payload)
    except Exception as e:
        print(f"❌ upsert_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/strategy")
def delete_live_strategy():
    """현재 활성 전략을 중지."""
    try:
        return stop_active_strategy()
    except Exception as e:
        print(f"❌ stop_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
