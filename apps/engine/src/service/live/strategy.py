"""라이브 전략 저장/조회/중지 서비스.

제약
- 활성 전략은 mode 당 1개씩 (paper 1 + real 1 동시 운영 가능).
- POST 는 트랜잭션 내에서 같은 mode 의 기존 활성 전략을 비활성화 후 새 전략 INSERT.
- 이 단계에서는 주문 발사/스케줄링 없음. 단순 상태 저장소.

Hysteresis 자동 도출
- exit_policy.signal_exit_clauses 가 비어 있고 진입 룰(clauses) 이 있으면
  upsert 시점에 자동으로 buffer 둔 청산 룰을 채워 백테스트 ↔ 라이브 동작을 일관되게 함.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from src.core.database import engine
from src.service.live.hysteresis import derive_signal_exit_clauses


_VALID_MODES = ("paper", "real")


def _validate_mode(mode: str) -> str:
    m = (mode or "").strip().lower()
    if m not in _VALID_MODES:
        raise ValueError(f"mode must be 'paper' or 'real', got '{mode}'")
    return m


def _row_to_dict(row) -> dict[str, Any]:
    """SQLAlchemy Row → JSON 직렬화 가능한 dict."""
    d = dict(row._mapping)
    for k in ("last_rebalance_at", "created_at", "updated_at"):
        v = d.get(k)
        if v is not None and hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


def get_active_strategy(mode: str = "paper") -> dict[str, Any] | None:
    """지정 mode 의 활성 라이브 전략. 없으면 None."""
    m = _validate_mode(mode)
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, name, universe, clauses, max_positions, exit_policy,
                       is_active, mode, position_size_krw, last_rebalance_at,
                       created_at, updated_at
                FROM live_strategies
                WHERE is_active AND mode = :mode
                LIMIT 1
                """
            ),
            {"mode": m},
        ).fetchone()
    return _row_to_dict(row) if row else None


def get_active_strategies() -> list[dict[str, Any]]:
    """현재 활성 전략 모두 (mode 별 0~1 개씩, 최대 2개)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, name, universe, clauses, max_positions, exit_policy,
                       is_active, mode, position_size_krw, last_rebalance_at,
                       created_at, updated_at
                FROM live_strategies
                WHERE is_active
                ORDER BY mode
                """
            )
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def upsert_active_strategy(payload: dict[str, Any]) -> dict[str, Any]:
    """지정 mode 의 활성 전략을 교체(또는 신규 활성화).

    같은 mode 의 기존 활성 전략을 is_active=false 로 내리고, 새 row 를 INSERT.
    트랜잭션으로 묶어 mode 별 partial unique index 충돌 방지.
    다른 mode 의 활성 전략은 영향 없음.
    """
    mode = _validate_mode(payload.get("mode", "paper"))
    clauses = payload["clauses"]
    clauses_json = json.dumps(clauses)

    exit_policy = dict(payload.get("exit_policy") or {})
    if not exit_policy.get("signal_exit_clauses") and clauses:
        exit_policy["signal_exit_clauses"] = derive_signal_exit_clauses(clauses)
    exit_policy_json = json.dumps(exit_policy) if exit_policy else None

    with engine.begin() as conn:
        replaced = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET is_active = false, updated_at = now()
                WHERE is_active AND mode = :mode
                RETURNING id, name
                """
            ),
            {"mode": mode},
        ).fetchone()

        new_row = conn.execute(
            text(
                """
                INSERT INTO live_strategies (
                    name, universe, clauses, max_positions, exit_policy,
                    is_active, mode, position_size_krw
                )
                VALUES (
                    :name, :universe, CAST(:clauses AS JSONB), :max_positions,
                    CAST(:exit_policy AS JSONB), true, :mode, :size
                )
                RETURNING id, name, universe, clauses, max_positions, exit_policy,
                          is_active, mode, position_size_krw, last_rebalance_at,
                          created_at, updated_at
                """
            ),
            {
                "name": payload.get("name") or "기본 전략",
                "universe": payload["universe"],
                "clauses": clauses_json,
                "max_positions": payload.get("max_positions", 10),
                "exit_policy": exit_policy_json,
                "mode": mode,
                "size": payload.get("position_size_krw", 1_000_000),
            },
        ).fetchone()

    result = _row_to_dict(new_row)
    result["replaced"] = (
        {"id": replaced.id, "name": replaced.name} if replaced else None
    )
    return result


def list_strategies() -> list[dict[str, Any]]:
    """저장된 모든 라이브 전략을 mode → is_active → updated_at 순으로 반환."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, name, universe, clauses, max_positions, exit_policy,
                       is_active, mode, position_size_krw, last_rebalance_at,
                       created_at, updated_at
                FROM live_strategies
                ORDER BY mode, is_active DESC, updated_at DESC
                """
            )
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def activate_strategy(strategy_id: int) -> dict[str, Any]:
    """지정 전략 활성화. 같은 mode 의 다른 활성 전략은 자동 비활성화 (다른 mode 는 그대로)."""
    with engine.begin() as conn:
        target = conn.execute(
            text("SELECT id, name, mode FROM live_strategies WHERE id = :id"),
            {"id": strategy_id},
        ).fetchone()
        if target is None:
            raise ValueError(f"strategy id={strategy_id} not found")
        mode = target.mode

        replaced = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET is_active = false, updated_at = now()
                WHERE is_active AND mode = :mode AND id != :id
                RETURNING id, name
                """
            ),
            {"id": strategy_id, "mode": mode},
        ).fetchone()

        new_row = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET is_active = true, updated_at = now()
                WHERE id = :id
                RETURNING id, name, universe, clauses, max_positions, exit_policy,
                          is_active, mode, position_size_krw, last_rebalance_at,
                          created_at, updated_at
                """
            ),
            {"id": strategy_id},
        ).fetchone()

    result = _row_to_dict(new_row)
    result["replaced"] = (
        {"id": replaced.id, "name": replaced.name} if replaced else None
    )
    return result


def delete_strategy(strategy_id: int) -> dict[str, Any]:
    """비활성 전략 삭제. 활성 전략은 거부 (먼저 stop 또는 다른 전략 활성화 후)."""
    with engine.begin() as conn:
        target = conn.execute(
            text("SELECT id, name, is_active FROM live_strategies WHERE id = :id"),
            {"id": strategy_id},
        ).fetchone()
        if target is None:
            raise ValueError(f"strategy id={strategy_id} not found")
        if target.is_active:
            raise ValueError("cannot delete active strategy — stop or switch first")

        conn.execute(
            text("DELETE FROM live_strategies WHERE id = :id"),
            {"id": strategy_id},
        )
    return {"deleted": True, "id": target.id, "name": target.name}


def update_active_size(position_size_krw: int, mode: str = "paper") -> dict[str, Any]:
    """지정 mode 활성 전략의 종목당 배분 금액만 수정."""
    m = _validate_mode(mode)
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET position_size_krw = :size, updated_at = now()
                WHERE is_active AND mode = :mode
                RETURNING id, name, universe, clauses, max_positions, exit_policy,
                          is_active, mode, position_size_krw, last_rebalance_at,
                          created_at, updated_at
                """
            ),
            {"size": int(position_size_krw), "mode": m},
        ).fetchone()
    if row is None:
        raise ValueError(f"활성 {m} 전략이 없습니다")
    return _row_to_dict(row)


def stop_active_strategy(mode: str = "paper") -> dict[str, Any]:
    """지정 mode 활성 전략 비활성화. 없으면 stopped=False."""
    m = _validate_mode(mode)
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET is_active = false, updated_at = now()
                WHERE is_active AND mode = :mode
                RETURNING id, name
                """
            ),
            {"mode": m},
        ).fetchone()

    if row is None:
        return {"stopped": False, "mode": m}
    return {"stopped": True, "id": row.id, "name": row.name, "mode": m}
