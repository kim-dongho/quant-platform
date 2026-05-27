from datetime import timedelta
from typing import Dict, List, Optional

import pandas as pd
import pandas_ta_classic as ta
from sqlalchemy import MetaData, Table, text
from sqlalchemy.dialects.postgresql import insert

from src.core.database import engine

metadata = MetaData()

# Table reflection은 DB 왕복이 발생 — 대량 루프에서는 호출당 수백 ms 누적됨.
# 모듈 레벨에서 한 번만 autoload하고 재사용한다.
_factors_table: Optional[Table] = None


def _get_factors_table() -> Table:
    global _factors_table
    if _factors_table is None:
        _factors_table = Table("factors", metadata, autoload_with=engine)
    return _factors_table


FACTOR_COLUMNS = [
    "rsi_14",
    "sma_20",
    "sma_50",
    "sma_200",
    "vol_ratio_20d",
    "return_5d",
    "price_vs_sma20",
    "price_vs_sma50",
    "price_vs_sma200",
    "sma20_vs_sma50",
    "sma50_vs_sma200",
]


def get_factor_max_times(symbols: List[str]) -> Dict[str, object]:
    """factors 전체를 한 번에 GROUP BY — symbol별 MAX(time) dict."""
    if not symbols:
        return {}
    wanted = set(symbols)
    with engine.connect() as conn:
        rows = (
            conn.execute(text("SELECT symbol, MAX(time) AS t FROM factors GROUP BY symbol"))
            .mappings()
            .all()
        )
    return {r["symbol"]: r["t"] for r in rows if r["symbol"] in wanted and r["t"] is not None}


def get_market_max_times(symbols: List[str]) -> Dict[str, object]:
    """market_data 전체를 한 번에 GROUP BY — symbol별 MAX(time) dict."""
    if not symbols:
        return {}
    wanted = set(symbols)
    with engine.connect() as conn:
        rows = (
            conn.execute(text("SELECT symbol, MAX(time) AS t FROM market_data GROUP BY symbol"))
            .mappings()
            .all()
        )
    return {r["symbol"]: r["t"] for r in rows if r["symbol"] in wanted and r["t"] is not None}


# 가장 긴 lookback 지표(SMA200)가 정확히 계산되려면 최소 200 거래일이 필요.
# 캘린더 400일 ≈ 280 trading days로 SMA200 + 공휴일 많은 KRX도 안전하게 커버.
_LOOKBACK_DAYS = 400


def _load_ohlcv(symbol: str, since=None) -> pd.DataFrame:
    """market_data에서 OHLCV 로드. since 지정 시 해당 시점 이후만."""
    if since is None:
        query = text(
            """
            SELECT time, open, high, low, close, volume
            FROM market_data
            WHERE symbol = :symbol
            ORDER BY time ASC
            """
        )
        params = {"symbol": symbol}
    else:
        query = text(
            """
            SELECT time, open, high, low, close, volume
            FROM market_data
            WHERE symbol = :symbol AND time > :since
            ORDER BY time ASC
            """
        )
        params = {"symbol": symbol, "since": since}

    with engine.connect() as conn:
        return pd.read_sql(query, conn, params=params)


def _last_factor_time(symbol: str):
    """factors 테이블에서 해당 종목의 최신 time. 없으면 None."""
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT MAX(time) FROM factors WHERE symbol = :s"),
            {"s": symbol},
        ).scalar()


def _compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """OHLCV DataFrame에 팩터 컬럼을 추가해 반환 (원본 수정)."""
    df["rsi_14"] = ta.rsi(df["close"], length=14)
    df["sma_20"] = df["close"].rolling(window=20).mean()
    df["sma_50"] = df["close"].rolling(window=50).mean()
    df["sma_200"] = df["close"].rolling(window=200).mean()

    vol_sma_20 = df["volume"].rolling(window=20).mean()
    df["vol_ratio_20d"] = df["volume"] / vol_sma_20

    df["return_5d"] = df["close"].pct_change(periods=5)
    df["price_vs_sma20"] = df["close"] / df["sma_20"] - 1
    df["price_vs_sma50"] = df["close"] / df["sma_50"] - 1
    df["price_vs_sma200"] = df["close"] / df["sma_200"] - 1
    df["sma20_vs_sma50"] = df["sma_20"] / df["sma_50"] - 1
    df["sma50_vs_sma200"] = df["sma_50"] / df["sma_200"] - 1
    return df


def compute_factors_for_symbol(
    symbol: str,
    incremental: bool = True,
    last_time=None,
) -> int:
    """
    팩터 계산 후 factors 테이블에 upsert. 증분 모드면 마지막 계산 시점 이후 rows만 갱신.

    incremental=True (기본):
      - factors에 기록이 있으면 (last_factor_time - LOOKBACK_DAYS) 이후 market_data만 로드
      - 지표 계산 후 last_factor_time 이후 rows만 upsert
      - 최초 계산(기록 없음)이면 전체 시계열 계산으로 fallback

    incremental=False:
      - 전체 시계열 재계산 (마이그레이션·지표 정의 변경 시 필요)

    last_time:
      - bulk 루프에서 이미 조회한 값을 그대로 넘겨 중복 MAX(time) 쿼리를 회피.
      - None(기본)이고 incremental이면 내부에서 단일 조회.

    반환: upsert된 row 수.
    """
    if incremental and last_time is None:
        last_time = _last_factor_time(symbol)
    elif not incremental:
        last_time = None

    if last_time is not None:
        # SMA50 연속성을 위해 lookback 만큼 이전 데이터도 포함
        cutoff = last_time - timedelta(days=_LOOKBACK_DAYS)
        df = _load_ohlcv(symbol, since=cutoff)
    else:
        df = _load_ohlcv(symbol)

    if df.empty or len(df) < 50:
        return 0

    df = _compute_indicators(df)
    df["symbol"] = symbol

    out = df[["time", "symbol", *FACTOR_COLUMNS]].dropna(subset=["sma_50"])

    # 증분이면 새로 생긴 rows 만 대상 — 재계산된 과거 구간은 그대로 유지
    if last_time is not None:
        out = out[out["time"] > last_time]

    if out.empty:
        return 0

    # NaN → None (psycopg2 NULL 매핑)
    records = out.astype(object).where(pd.notnull(out), None).to_dict(orient="records")
    if not records:
        return 0

    factors_table = _get_factors_table()
    stmt = insert(factors_table).values(records)
    stmt = stmt.on_conflict_do_update(
        index_elements=["time", "symbol"],
        set_={col: getattr(stmt.excluded, col) for col in FACTOR_COLUMNS},
    )

    try:
        with engine.begin() as conn:
            conn.execute(stmt)
        return len(records)
    except Exception as e:
        print(f"❌ Factor upsert failed for {symbol}: {e}")
        return 0
