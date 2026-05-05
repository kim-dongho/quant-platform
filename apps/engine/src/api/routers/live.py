"""라이브 전략 (활성 1개 + 라이브러리) CRUD 라우터."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.api.deps import exit_policy_to_dict
from src.api.schemas import LiveStrategyRequest
from pydantic import BaseModel

from src.service.live import (
    activate_strategy,
    delete_strategy,
    get_active_strategy,
    get_realized_pnl_summary,
    list_strategies,
    stop_active_strategy,
    update_active_size,
    upsert_active_strategy,
)


class UpdateSizeRequest(BaseModel):
    """활성 전략의 종목당 배분 금액만 patch 할 때 사용. 0 이하 → 자본 균등 분배."""

    position_size_krw: int


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


@router.patch("/strategy")
def patch_live_strategy(req: UpdateSizeRequest):
    """활성 전략의 종목당 배분 금액만 수정 (룰·청산 정책은 그대로)."""
    try:
        return update_active_size(req.position_size_krw)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ patch_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/strategy")
def delete_live_strategy():
    """현재 활성 전략을 중지."""
    try:
        return stop_active_strategy()
    except Exception as e:
        print(f"❌ stop_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/strategies")
def list_live_strategies():
    """저장된 전체 라이브 전략 목록 (활성 1개 + 비활성 N개) 을 반환."""
    try:
        return list_strategies()
    except Exception as e:
        print(f"❌ list_live_strategies failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/strategies/{strategy_id}/activate")
def activate_live_strategy(strategy_id: int):
    """저장된 전략을 활성화. 기존 활성 전략은 자동 비활성화."""
    try:
        return activate_strategy(strategy_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ activate_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/realized-pnl")
def get_live_realized_pnl():
    """현재 활성 전략의 청산 완료 거래 누적 실현손익 + 거래 리스트.

    활성 전략이 없으면 0으로 채워진 빈 응답을 반환.
    """
    try:
        active = get_active_strategy()
        if not active:
            return {
                "total_pnl_krw": 0,
                "total_pnl_pct": 0.0,
                "closed_count": 0,
                "win_count": 0,
                "loss_count": 0,
                "win_rate": 0.0,
                "trades": [],
            }
        return get_realized_pnl_summary(active["id"])
    except Exception as e:
        print(f"❌ get_live_realized_pnl failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/strategies/{strategy_id}")
def remove_live_strategy(strategy_id: int):
    """비활성 전략을 영구 삭제. 활성 전략은 거부."""
    try:
        return delete_strategy(strategy_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ delete_live_strategy failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
