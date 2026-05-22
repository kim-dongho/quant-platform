"""yfinance 1시간봉 ingest — `candles_1h` 테이블에 저장.

yfinance `interval=1h` 는 최대 730일 (약 2년) 까지 제공.
일봉과 별개 테이블에 저장해 multi-timeframe 차트가 사용.

사용:
    from src.service.ingest.yfinance_1h import save_1h_to_db
    save_1h_to_db("IREN")
"""

from __future__ import annotations

import pandas as pd
import yfinance as yf
from sqlalchemy import MetaData, Table, text
from sqlalchemy.dialects.postgresql import insert

from src.core.database import engine

metadata = MetaData()


def save_1h_to_db(ticker: str, period: str = "730d") -> int:
    """단일 종목 1h 봉 시세 수집. 반환: 저장된 row 개수.

    KRX 종목 (.KS / .KQ) 은 yfinance 1h interval 이 한국 거래소를 일부 지원하지만
    데이터 안정성이 떨어져 별도 핸들링 안 함 — 미국 종목만 사용 권장.
    """
    print(f"📥 1h ingest: {ticker} (period={period})")

    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval="1h")
    except Exception as e:
        print(f"❌ API fetch failed for {ticker}: {e}")
        return 0

    if df.empty:
        print(f"⚠️ No 1h data for {ticker}")
        return 0

    df = df.reset_index()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    # yfinance 가 'Datetime' 또는 'Date' 로 인덱스 컬럼명 반환 — 둘 다 대응.
    time_col = "Datetime" if "Datetime" in df.columns else "Date"
    rename_map = {
        time_col: "time",
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Volume": "volume",
    }
    df = df.rename(columns=rename_map)
    df["symbol"] = ticker

    rows = df[["time", "symbol", "open", "high", "low", "close", "volume"]].to_dict(
        orient="records"
    )

    if not rows:
        return 0

    try:
        with engine.connect() as conn:
            # stocks 행 보장 — FK 제약 충족용 (이름이 없으면 ticker 자체로).
            conn.execute(
                text(
                    "INSERT INTO stocks (symbol, name) VALUES (:tick, :tick) "
                    "ON CONFLICT (symbol) DO NOTHING"
                ),
                {"tick": ticker},
            )

            table = Table("candles_1h", metadata, autoload_with=engine)
            stmt = insert(table).values(rows)
            stmt = stmt.on_conflict_do_nothing(index_elements=["time", "symbol"])
            conn.execute(stmt)
            conn.commit()
            print(f"✅ Saved {len(rows)} 1h rows for {ticker}")
            return len(rows)
    except Exception as e:
        print(f"❌ DB write failed for {ticker}: {e}")
        return 0


def save_1h_bulk(tickers: list[str], period: str = "730d") -> dict[str, int]:
    """여러 종목 일괄 — rate limit 회피용 sleep 포함."""
    import time

    results: dict[str, int] = {}
    for i, t in enumerate(tickers):
        if i > 0:
            time.sleep(0.5)  # yfinance rate limit 회피
        results[t] = save_1h_to_db(t, period=period)
    return results
