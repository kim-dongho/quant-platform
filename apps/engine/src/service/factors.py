import pandas as pd
import pandas_ta_classic as ta
from sqlalchemy import MetaData, Table, text
from sqlalchemy.dialects.postgresql import insert

from src.core.database import engine

metadata = MetaData()

FACTOR_COLUMNS = [
    "rsi_14",
    "sma_20",
    "sma_50",
    "vol_ratio_20d",
    "return_5d",
    "price_vs_sma50",
]


def _load_ohlcv(symbol: str) -> pd.DataFrame:
    """DB에서 해당 종목의 일봉 OHLCV를 시간 오름차순으로 로드."""
    query = text(
        """
        SELECT time, open, high, low, close, volume
        FROM market_data
        WHERE symbol = :symbol
        ORDER BY time ASC
        """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"symbol": symbol})
    return df


def compute_factors_for_symbol(symbol: str) -> int:
    """
    market_data에서 해당 종목의 전체 시계열을 읽어 팩터를 계산하고 factors 테이블에 upsert.
    반환값: upsert된 row 수.
    """
    df = _load_ohlcv(symbol)
    if df.empty or len(df) < 50:
        # SMA50 계산에 최소 50봉 필요
        return 0

    df["rsi_14"] = ta.rsi(df["close"], length=14)
    df["sma_20"] = df["close"].rolling(window=20).mean()
    df["sma_50"] = df["close"].rolling(window=50).mean()

    vol_sma_20 = df["volume"].rolling(window=20).mean()
    df["vol_ratio_20d"] = df["volume"] / vol_sma_20

    df["return_5d"] = df["close"].pct_change(periods=5)
    df["price_vs_sma50"] = df["close"] / df["sma_50"] - 1

    df["symbol"] = symbol
    out = df[["time", "symbol", *FACTOR_COLUMNS]].dropna(subset=["sma_50"])
    # NaN을 None으로 변환해야 psycopg2가 NULL로 처리
    records = out.astype(object).where(pd.notnull(out), None).to_dict(orient="records")

    if not records:
        return 0

    factors_table = Table("factors", metadata, autoload_with=engine)
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
