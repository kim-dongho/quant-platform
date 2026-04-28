"""API 라우터들이 공유하는 변환·헬퍼."""
from __future__ import annotations

from typing import Any, Dict, Optional

from src.api.schemas import ExitPolicyModel


def exit_policy_to_dict(p: Optional[ExitPolicyModel]) -> Optional[Dict[str, Any]]:
    """ExitPolicyModel(Pydantic) → 서비스 레이어가 받는 dict 형태로 변환."""
    if p is None:
        return None
    return {
        "stop_loss_pct": p.stop_loss_pct,
        "take_profit_pct": p.take_profit_pct,
        "trailing_stop_pct": p.trailing_stop_pct,
        "time_exit_days": p.time_exit_days,
        "signal_exit_clauses": [c.model_dump() for c in p.signal_exit_clauses],
    }
