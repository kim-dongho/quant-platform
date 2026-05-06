import math
from datetime import date
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy import text

from src.core.config import UNIVERSE_NAMES, get_universe
from src.core.database import engine
from src.service.factor.compute import FACTOR_COLUMNS

# Risk-adjusted momentum (12-1, vol-normalized) lookback days.
# 252영업일 ≈ 1년, 21영업일 ≈ 1개월.
MOMENTUM_LOOKBACK = 252
SHORT_REVERSAL = 21
# 252일 윈도 + 1개월 reversal 제거 + 약간의 holiday buffer
PRICE_HISTORY_DAYS = MOMENTUM_LOOKBACK + SHORT_REVERSAL + 30

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
    # WHERE 통과한 종목을 모두 받아 ranking 후 max_positions 만 반환.
    # 35종목 정도까지는 부담 없음 (KRX 350 universe + 룰 통과 케이스).
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
        """
    )

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

    raw_candidates: List[Dict[str, Any]] = []
    for row in result:
        raw_candidates.append(
            {
                "symbol": row["symbol"],
                "company_name": row["company_name"],
                "price": float(row["price"]) if row["price"] is not None else None,
                "as_of": row["time"].date().isoformat() if row["time"] else None,
                "factors": {
                    c: (float(row[c]) if row[c] is not None else None) for c in FACTOR_COLUMNS
                },
            }
        )

    # WHERE 통과 후보 → risk-adjusted momentum 으로 ranking, top max_positions 만 반환.
    candidates = _rank_by_momentum(raw_candidates, as_of_date)[:max_positions]

    return {
        "as_of": as_of_date,
        "universe_size": len(symbols),
        "with_data": int(coverage),
        "candidates": candidates,
    }


def _rank_by_momentum(candidates: List[Dict[str, Any]], as_of_date: str) -> List[Dict[str, Any]]:
    """후보를 risk-adjusted momentum (Jegadeesh-Titman 12-1, vol-normalized) 으로 정렬.

    score = (ret_252d - ret_21d) / vol_252d
      - ret_252d: 12개월 추세
      - −ret_21d: 단기 1개월 반전 효과 제거
      - / vol_252d: 변동성 큰 종목 가산점 디스카운트

    score 계산 실패 (데이터 부족 등) 한 종목은 −∞ 로 처리해 맨 아래로.
    """
    if not candidates:
        return []

    symbols = [c["symbol"] for c in candidates]
    placeholders = ", ".join([f":s{i}" for i in range(len(symbols))])
    params: Dict[str, Any] = {"as_of": as_of_date, "lookback": PRICE_HISTORY_DAYS}
    for i, s in enumerate(symbols):
        params[f"s{i}"] = s

    history_query = text(
        f"""
        SELECT symbol, time, close
        FROM market_data
        WHERE symbol IN ({placeholders})
          AND time <= :as_of
          AND time >= (CAST(:as_of AS date) - (:lookback || ' days')::interval)
        ORDER BY symbol, time
        """
    )

    with engine.connect() as conn:
        rows = conn.execute(history_query, params).mappings().all()

    # symbol → close 시계열
    series_by_symbol: Dict[str, pd.Series] = {}
    if rows:
        df = pd.DataFrame(rows)
        for sym, group in df.groupby("symbol"):
            series_by_symbol[sym] = (
                group.sort_values("time").set_index("time")["close"].astype(float)
            )

    scored: List[tuple[float, Dict[str, Any]]] = []
    for c in candidates:
        score = _momentum_score(series_by_symbol.get(c["symbol"]))
        c["momentum_score"] = score if math.isfinite(score) else None
        scored.append((score, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored]


def _momentum_score(close: Optional[pd.Series]) -> float:
    """단일 종목의 risk-adjusted momentum score. 데이터 부족 시 -inf 반환."""
    if close is None or len(close) < MOMENTUM_LOOKBACK + 1:
        return float("-inf")
    last = float(close.iloc[-1])
    base_252 = float(close.iloc[-MOMENTUM_LOOKBACK - 1])
    base_21 = float(close.iloc[-SHORT_REVERSAL - 1])
    if base_252 <= 0 or base_21 <= 0:
        return float("-inf")
    ret_252 = last / base_252 - 1.0
    ret_21 = last / base_21 - 1.0
    daily_returns = close.pct_change().dropna().tail(MOMENTUM_LOOKBACK)
    if len(daily_returns) < 30:
        return float("-inf")
    vol = float(daily_returns.std()) * math.sqrt(MOMENTUM_LOOKBACK)
    if vol <= 0 or not math.isfinite(vol):
        return float("-inf")
    return (ret_252 - ret_21) / vol
