"""
국내(KOSPI/KOSDAQ) 종목 시세·회사명 수집 — FinanceDataReader 기반.

DB 스키마는 미국과 공유 (stocks, market_data). symbol은 '005930.KS' / '066570.KQ' 형식으로
저장해 미국 티커와 구분되고, yfinance와도 호환되는 포맷을 유지한다.
"""
from __future__ import annotations

import FinanceDataReader as fdr
import pandas as pd
from sqlalchemy import MetaData, Table, text
from sqlalchemy.dialects.postgresql import insert

from src.core.config import _load_krx_listing, is_krx_symbol
from src.core.database import engine

metadata = MetaData()


def _split_symbol(symbol: str) -> tuple[str, str]:
    """'005930.KS' → ('005930', 'KS'). KRX 심볼이 아니면 예외."""
    if not is_krx_symbol(symbol):
        raise ValueError(f"Not a KRX symbol: {symbol}")
    code, suffix = symbol.rsplit(".", 1)
    return code, suffix


def _resolve_name(code: str) -> str | None:
    """FDR listing에서 회사명 조회. 실패하면 None."""
    try:
        df = _load_krx_listing()
        match = df[df["Code"] == code]
        if not match.empty:
            return str(match["Name"].iloc[0])
    except Exception:
        pass
    return None


def save_krx_to_db(symbol: str) -> None:
    """
    단일 KRX 종목을 FDR로 수집 → stocks + market_data 저장 → factor precompute.

    미국용 save_to_db와 동일한 interface·동작을 목표로 한다.
    """
    code, _suffix = _split_symbol(symbol)
    print(f"📥 Processing KRX {symbol}...")

    company_name = _resolve_name(code)
    display_name = company_name or symbol
    print(f"🏢 Company: {display_name}")

    try:
        # FDR은 start/end 생략 시 상장 이후 전체 기간 반환
        df = fdr.DataReader(code)
    except Exception as e:
        print(f"❌ FDR fetch failed for {symbol}: {e}")
        return

    if df is None or df.empty:
        print(f"⚠️ No data found for {symbol}")
        return

    df = df.reset_index()
    rename_map = {
        "Date": "time",
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Volume": "volume",
    }
    df = df.rename(columns=rename_map)
    required = {"time", "open", "high", "low", "close", "volume"}
    if not required.issubset(df.columns):
        print(f"⚠️ Missing OHLCV columns for {symbol}: {df.columns.tolist()}")
        return

    df["symbol"] = symbol
    df = df.dropna(subset=["time", "open", "high", "low", "close"])
    if df.empty:
        return

    rows = df[["time", "symbol", "open", "high", "low", "close", "volume"]].to_dict(
        orient="records"
    )

    try:
        with engine.connect() as conn:
            if company_name:
                stock_stmt = text(
                    """
                    INSERT INTO stocks (symbol, name)
                    VALUES (:tick, :name)
                    ON CONFLICT (symbol)
                    DO UPDATE SET name = EXCLUDED.name
                    """
                )
                conn.execute(stock_stmt, {"tick": symbol, "name": company_name})
            else:
                stock_stmt = text(
                    """
                    INSERT INTO stocks (symbol, name)
                    VALUES (:tick, :tick)
                    ON CONFLICT (symbol) DO NOTHING
                    """
                )
                conn.execute(stock_stmt, {"tick": symbol})

            if rows:
                market_data_table = Table("market_data", metadata, autoload_with=engine)
                stmt = insert(market_data_table).values(rows)
                stmt = stmt.on_conflict_do_nothing(index_elements=["time", "symbol"])
                conn.execute(stmt)
                conn.commit()
                print(f"✅ Saved {len(df)} rows for {symbol} ({display_name})")
    except Exception as e:
        print(f"❌ DB Write Error for {symbol}: {e}")
        return

    try:
        from src.service.factor import compute_factors_for_symbol

        n = compute_factors_for_symbol(symbol)
        if n:
            print(f"📊 Factors updated: {n} rows for {symbol}")
    except Exception as e:
        print(f"⚠️ Factor computation skipped for {symbol}: {e}")
