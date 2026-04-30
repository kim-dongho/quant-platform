"""라이브 전략 저장/조회/중지 서비스.

MVP 제약
- 활성 전략은 동시에 1개만 허용 (partial unique index 로 DB 레벨 강제).
- POST 는 트랜잭션 내에서 기존 활성 전략을 자동 비활성화 후 새 전략을 활성 상태로 INSERT.
- 이 단계에서는 주문 발사/스케줄링 없음. 단순 상태 저장소.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from src.core.database import engine


def _row_to_dict(row) -> dict[str, Any]:
    """SQLAlchemy Row → JSON 직렬화 가능한 dict."""
    d = dict(row._mapping)
    # JSONB 컬럼은 드라이버가 이미 dict/list 로 반환하므로 그대로 사용.
    # datetime 은 FastAPI 가 ISO 직렬화하지만, 통일성 위해 isoformat 적용.
    for k in ("last_rebalance_at", "created_at", "updated_at"):
        v = d.get(k)
        if v is not None and hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


def get_active_strategy() -> dict[str, Any] | None:
    """현재 활성화된 라이브 전략을 반환. 없으면 None."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, name, universe, clauses, max_positions, exit_policy,
                       is_active, mode, position_size_krw, last_rebalance_at,
                       created_at, updated_at
                FROM live_strategies
                WHERE is_active
                LIMIT 1
                """
            )
        ).fetchone()
    return _row_to_dict(row) if row else None


def upsert_active_strategy(payload: dict[str, Any]) -> dict[str, Any]:
    """활성 전략을 교체(또는 신규 활성화).

    기존 활성 전략이 있으면 is_active=false 로 내리고, 새 row 를 is_active=true 로 INSERT.
    트랜잭션으로 묶어 partial unique index 충돌을 방지한다.

    Returns: 새로 활성화된 전략 dict (기존 교체된 전략 정보는 `replaced` 키에 포함).
    """
    clauses_json = json.dumps(payload["clauses"])
    exit_policy_json = (
        json.dumps(payload["exit_policy"]) if payload.get("exit_policy") is not None else None
    )

    with engine.begin() as conn:
        replaced = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET is_active = false, updated_at = now()
                WHERE is_active
                RETURNING id, name
                """
            )
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
                "mode": payload.get("mode", "paper"),
                "size": payload.get("position_size_krw", 1_000_000),
            },
        ).fetchone()

    result = _row_to_dict(new_row)
    result["replaced"] = (
        {"id": replaced.id, "name": replaced.name} if replaced else None
    )
    return result


def list_strategies() -> list[dict[str, Any]]:
    """저장된 모든 라이브 전략을 최근 활성화·수정 순으로 반환 (활성 1개 + 비활성 N개)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, name, universe, clauses, max_positions, exit_policy,
                       is_active, mode, position_size_krw, last_rebalance_at,
                       created_at, updated_at
                FROM live_strategies
                ORDER BY is_active DESC, updated_at DESC
                """
            )
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def activate_strategy(strategy_id: int) -> dict[str, Any]:
    """지정한 전략을 활성화. 기존 활성 전략은 자동으로 비활성화.

    Returns: 새로 활성화된 전략 dict (`replaced` 키에 교체된 전략 정보).
    """
    with engine.begin() as conn:
        target = conn.execute(
            text("SELECT id, name FROM live_strategies WHERE id = :id"),
            {"id": strategy_id},
        ).fetchone()
        if target is None:
            raise ValueError(f"strategy id={strategy_id} not found")

        replaced = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET is_active = false, updated_at = now()
                WHERE is_active AND id != :id
                RETURNING id, name
                """
            ),
            {"id": strategy_id},
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
    """비활성 전략을 삭제. 활성 전략은 삭제 거부 (먼저 다른 전략 활성화하거나 stop 후)."""
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


def update_active_size(position_size_krw: int) -> dict[str, Any]:
    """활성 전략의 종목당 배분 금액만 수정. 새 row 안 만들고 같은 row UPDATE.

    position_size_krw <= 0 → 자본 균등 분배 모드 (executor 가 잔고 ÷ 슬롯 동적 계산).
    """
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET position_size_krw = :size, updated_at = now()
                WHERE is_active
                RETURNING id, name, universe, clauses, max_positions, exit_policy,
                          is_active, mode, position_size_krw, last_rebalance_at,
                          created_at, updated_at
                """
            ),
            {"size": int(position_size_krw)},
        ).fetchone()
    if row is None:
        raise ValueError("활성 전략이 없습니다")
    return _row_to_dict(row)


def stop_active_strategy() -> dict[str, Any]:
    """현재 활성 전략을 비활성화. 활성 전략이 없으면 stopped=false 반환."""
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                UPDATE live_strategies
                SET is_active = false, updated_at = now()
                WHERE is_active
                RETURNING id, name
                """
            )
        ).fetchone()

    if row is None:
        return {"stopped": False}
    return {"stopped": True, "id": row.id, "name": row.name}
