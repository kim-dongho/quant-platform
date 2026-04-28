from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from src.core.config import UNIVERSE_NAMES, get_universe
from src.core.database import engine
from src.service.factor.compute import FACTOR_COLUMNS

# 'all' 유니버스: DB에 데이터가 있는 모든 symbol을 동적으로 반환.
ALL_UNIVERSE = "all"

ALLOWED_OPS = {"<", ">", "<=", ">=", "=", "!="}


class ScreenError(Exception):
    pass


def _validate_clauses(clauses: List[Dict[str, Any]]):
    for c in clauses:
        factor = c.get("factor")
        op = c.get("op")
        value = c.get("value")
        if factor not in FACTOR_COLUMNS:
            raise ScreenError(f"Unknown factor: {factor}. Allowed: {FACTOR_COLUMNS}")
        if op not in ALLOWED_OPS:
            raise ScreenError(f"Unknown op: {op}. Allowed: {sorted(ALLOWED_OPS)}")
        if not isinstance(value, (int, float)):
            raise ScreenError(f"Value must be number for factor {factor}")


def _resolve_universe(name: str) -> List[str]:
    if name == ALL_UNIVERSE:
        # DB에 있는 모든 symbol을 동적으로 반환
        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT DISTINCT symbol FROM market_data ORDER BY symbol")
            ).all()
        return [r[0] for r in rows]
    if name not in UNIVERSE_NAMES:
        raise ScreenError(
            f"Unknown universe: {name}. Allowed: {sorted(UNIVERSE_NAMES) + [ALL_UNIVERSE]}"
        )
    # 중복 제거(순서 보존)
    seen = set()
    result: List[str] = []
    for s in get_universe(name):
        if s not in seen:
            seen.add(s)
            result.append(s)
    return result


def run_screen(
    universe: str,
    clauses: List[Dict[str, Any]],
    max_positions: int = 10,
    as_of: Optional[str] = None,
) -> Dict[str, Any]:
    """
    유니버스 내 종목들의 가장 최근 팩터 스냅샷을 룰 clauses에 적용해 통과 종목 반환.
    as_of가 주어지면 해당 날짜 이하의 가장 최근 스냅샷을 사용.
    """
    _validate_clauses(clauses)
    symbols = _resolve_universe(universe)
    if not symbols:
        return {"as_of": None, "universe_size": 0, "with_data": 0, "candidates": []}

    # as_of 파라미터 — 없으면 오늘 (실제 비교는 <=)
    as_of_date = as_of or date.today().isoformat()

    # clauses를 파라미터 바인딩으로 SQL where 절로 변환 (factor 이름은 allowlist 검증 끝)
    where_parts = []
    params: Dict[str, Any] = {"as_of": as_of_date}
    for i, c in enumerate(clauses):
        col = c["factor"]
        op = c["op"]
        pname = f"v{i}"
        where_parts.append(f"l.{col} {op} :{pname}")
        params[pname] = c["value"]

    where_sql = " AND ".join(where_parts) if where_parts else "TRUE"

    # DISTINCT ON으로 symbol별 가장 최근 팩터 row를 뽑은 뒤 절 적용
    placeholders = ", ".join([f":s{i}" for i in range(len(symbols))])
    for i, s in enumerate(symbols):
        params[f"s{i}"] = s

    select_cols = ", ".join([f"l.{c}" for c in FACTOR_COLUMNS])
    query = text(
        f"""
        WITH latest AS (
            SELECT DISTINCT ON (symbol)
                symbol, time, {", ".join(FACTOR_COLUMNS)}
            FROM factors
            WHERE symbol IN ({placeholders})
              AND time <= :as_of
              AND time >= (CAST(:as_of AS date) - INTERVAL '60 days')
            ORDER BY symbol, time DESC
        )
        SELECT
            l.symbol,
            l.time,
            {select_cols},
            md.close AS price,
            s.name AS company_name
        FROM latest l
        LEFT JOIN market_data md ON md.symbol = l.symbol AND md.time = l.time
        LEFT JOIN stocks s ON s.symbol = l.symbol
        WHERE {where_sql}
        LIMIT :max_positions
        """
    )
    params["max_positions"] = max_positions

    # 커버리지 확인용 (with_data = 최근 60일 내 스냅샷이 있는 종목 수)
    coverage_query = text(
        f"""
        SELECT COUNT(DISTINCT symbol) AS cnt
        FROM factors
        WHERE symbol IN ({placeholders})
          AND time <= :as_of
          AND time >= (CAST(:as_of AS date) - INTERVAL '60 days')
        """
    )

    with engine.connect() as conn:
        result = conn.execute(query, params).mappings().all()
        coverage = conn.execute(coverage_query, params).scalar() or 0

    candidates = []
    for row in result:
        candidates.append(
            {
                "symbol": row["symbol"],
                "company_name": row["company_name"],
                "price": float(row["price"]) if row["price"] is not None else None,
                "as_of": row["time"].date().isoformat() if row["time"] else None,
                "factors": {c: (float(row[c]) if row[c] is not None else None) for c in FACTOR_COLUMNS},
            }
        )

    return {
        "as_of": as_of_date,
        "universe_size": len(symbols),
        "with_data": int(coverage),
        "candidates": candidates,
    }
