"""
전체 미국 상장 종목 bulk 수집 스크립트 — 컨테이너 내부에서 실행.

- 티커 소스: NASDAQ Trader 공식 CSV (기본) 또는 --tickers-file
- Bulk 다운로드: yf.download() multi-ticker로 batch당 한 번의 HTTP 호출
- 증분: DB에 데이터가 있는 종목은 마지막 날짜 이후만 요청
- 실패/상폐 종목은 로그만 남기고 전체는 계속 진행
- 수집 후 factor precompute까지 수행 (--skip-factors로 생략 가능)

사용 예:
    python -u -m src.scripts.ingest_bulk                    # NASDAQ 전체
    python -u -m src.scripts.ingest_bulk --limit 200        # 처음 200개 테스트
    python -u -m src.scripts.ingest_bulk --batch-size 50    # 배치 크기 조정
    python -u -m src.scripts.ingest_bulk --tickers-file /tmp/my_list.txt
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import pandas as pd
import yfinance as yf
from sqlalchemy import MetaData, Table, text
from sqlalchemy.dialects.postgresql import insert

from src.core.config import (
    get_bulk_ingest_universe,
    get_company_names_map,
    get_universe,
    is_krx_symbol,
)
from src.core.database import engine
from src.service.factors import compute_factors_for_symbol

DEFAULT_BATCH_SIZE = 100
DEFAULT_SLEEP = 1.5
# 10년 = 업계 표준 baseline. 2018 조정 + 2020 COVID crash + 2022 bear 등 다양한 사이클 포함.
# 7년 in-sample + 3년 out-of-sample split 가능.
DEFAULT_YEARS = 10

metadata = MetaData()


# ---------------------------------------------------------------------------
# 티커 리스트 로드 (파일 기반)
# ---------------------------------------------------------------------------
def load_tickers_from_file(path: str) -> List[str]:
    with open(path) as f:
        return [line.strip().upper() for line in f if line.strip() and not line.startswith("#")]


# ---------------------------------------------------------------------------
# DB 헬퍼
# ---------------------------------------------------------------------------
def get_last_dates(symbols: List[str]) -> Dict[str, datetime]:
    """전체 market_data의 symbol별 최신 시간을 한 번에 조회한 뒤 Python에서 필터.
    hypertable + 6000+ 심볼 IN/ANY 조합은 TimescaleDB에서 락/메모리 초과로 죽을 수 있어
    필터링은 Python 쪽으로 위임한다."""
    if not symbols:
        return {}
    wanted = set(symbols)
    query = text(
        """
        SELECT symbol, MAX(time) AS last_time
        FROM market_data
        GROUP BY symbol
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()
    return {
        r["symbol"]: r["last_time"]
        for r in rows
        if r["symbol"] in wanted and r["last_time"] is not None
    }


def cleanup_non_universe(valid_symbols: List[str]) -> Dict[str, int]:
    """valid_symbols에 없는 symbol의 데이터를 factors / market_data / market_data_1m / stocks에서 삭제."""
    if not valid_symbols:
        raise RuntimeError("Refusing to cleanup with empty valid_symbols")

    print(f"🧹 Cleaning up symbols not in curated universe ({len(valid_symbols)} symbols)...")

    # symbol 배열을 temp CTE로 묶어 각 테이블에서 NOT IN 삭제
    placeholders = ", ".join([f":v{i}" for i in range(len(valid_symbols))])
    params = {f"v{i}": s for i, s in enumerate(valid_symbols)}

    deleted: Dict[str, int] = {}
    with engine.begin() as conn:
        for table in ("factors", "market_data", "market_data_1m", "stocks"):
            try:
                result = conn.execute(
                    text(f"DELETE FROM {table} WHERE symbol NOT IN ({placeholders})"),
                    params,
                )
                deleted[table] = result.rowcount or 0
                print(f"   → {table}: {deleted[table]} rows deleted")
            except Exception as e:
                # market_data_1m이 없으면 스킵
                print(f"   ⚠️ {table} skipped: {e}")
                deleted[table] = 0
    return deleted


# 전역 name 맵 — main()에서 한 번 로드해서 upsert 시 사용
_NAME_MAP: Dict[str, str] = {}


def ensure_stock_row(ticker: str):
    name = _NAME_MAP.get(ticker, ticker)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO stocks (symbol, name) VALUES (:s, :n)
                ON CONFLICT (symbol) DO UPDATE SET name = EXCLUDED.name
                WHERE stocks.name = stocks.symbol OR stocks.name IS NULL OR stocks.name = ''
                """
            ),
            {"s": ticker, "n": name},
        )


def upsert_market_data(ticker: str, df: pd.DataFrame) -> int:
    """단일 종목의 OHLCV DataFrame을 market_data에 upsert."""
    if df is None or df.empty:
        return 0

    df = df.reset_index()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    rename_map = {
        "Date": "time",
        "Datetime": "time",
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Volume": "volume",
    }
    df = df.rename(columns=rename_map)
    required = {"time", "open", "high", "low", "close", "volume"}
    if not required.issubset(df.columns):
        return 0

    df["symbol"] = ticker
    df = df.dropna(subset=["time", "open", "high", "low", "close"])
    if df.empty:
        return 0

    rows = df[["time", "symbol", "open", "high", "low", "close", "volume"]].to_dict(orient="records")
    if not rows:
        return 0

    ensure_stock_row(ticker)
    table = Table("market_data", metadata, autoload_with=engine)
    stmt = insert(table).values(rows).on_conflict_do_nothing(index_elements=["time", "symbol"])

    try:
        with engine.begin() as conn:
            conn.execute(stmt)
        return len(rows)
    except Exception as e:
        print(f"    ❌ upsert failed for {ticker}: {e}")
        return 0


# ---------------------------------------------------------------------------
# Bulk 다운로드 로직
# ---------------------------------------------------------------------------
def _extract_symbol_df(bulk_df: pd.DataFrame, ticker: str, is_multi: bool) -> Optional[pd.DataFrame]:
    """yf.download 결과에서 특정 종목의 서브 DataFrame만 뽑아낸다."""
    try:
        if is_multi and isinstance(bulk_df.columns, pd.MultiIndex):
            sub = bulk_df[ticker].dropna(how="all")
        else:
            sub = bulk_df.dropna(how="all")
        return sub if not sub.empty else None
    except KeyError:
        return None


def bulk_fetch(symbols: List[str], start: Optional[str], period: Optional[str]) -> pd.DataFrame:
    """yf.download wrapper — start 또는 period 중 하나 사용."""
    kwargs = {
        "tickers": symbols,
        "group_by": "ticker",
        "auto_adjust": True,
        "progress": False,
        "threads": True,
    }
    if start:
        kwargs["start"] = start
    elif period:
        kwargs["period"] = period
    return yf.download(**kwargs)


def _fetch_krx_single(symbol: str, start: str) -> Optional[pd.DataFrame]:
    """단일 KRX 종목을 FDR로 수집. OHLCV+Date index의 DataFrame 반환 (없으면 None)."""
    import FinanceDataReader as fdr

    code = symbol.rsplit(".", 1)[0]
    try:
        df = fdr.DataReader(code, start)
    except Exception as e:
        print(f"    ❌ FDR {symbol}: {e}")
        return None
    if df is None or df.empty:
        return None
    df.index.name = "Date"
    return df


def process_krx_batch(
    batch: List[str], last_dates: Dict[str, datetime], today: datetime, first_start: str
) -> tuple[int, int]:
    """
    국내 종목은 FDR 단일 호출만 지원하므로 개별 순회. yfinance bulk와 달리 batch로 묶어도
    병렬 장점은 없지만 공통 로직(last_date 증분, upsert) 재사용을 위해 batch 단위로 처리한다.
    """
    succeeded = 0
    failed = 0
    for sym in batch:
        last = last_dates.get(sym)
        start = (last + timedelta(days=1)).date().isoformat() if last else first_start
        # 이미 최신이면 호출 자체 생략
        if last and last.date() >= today.date():
            succeeded += 1
            continue
        df = _fetch_krx_single(sym, start)
        if df is None:
            # 증분인데 새 데이터 없음 → 최신 상태로 간주
            if last:
                succeeded += 1
            else:
                failed += 1
            continue
        # 증분이면 last 이후로만
        if last is not None:
            df = df[df.index > last]
            if df.empty:
                succeeded += 1
                continue
        n = upsert_market_data(sym, df)
        succeeded += 1 if n > 0 else 0
    return succeeded, failed


def process_batch(
    batch: List[str], last_dates: Dict[str, datetime], today: datetime, first_start: str
) -> tuple[int, int]:
    """
    한 배치를 두 그룹으로 나눠 다운로드 (미국 종목 전용):
      - 처음 받는 종목: first_start 부터
      - 증분 종목: start=배치 내 가장 이른 last_date+1
    """
    first_time = [s for s in batch if s not in last_dates]
    incremental = [s for s in batch if s in last_dates]

    succeeded = 0
    failed = 0

    # 1) 처음 받는 종목 — first_start 부터 (신규 IPO도 에러 없이 가능한 만큼만 반환됨)
    if first_time:
        print(f"  ⤓ from {first_start} × {len(first_time)} — {', '.join(first_time[:3])}...")
        try:
            bulk = bulk_fetch(first_time, start=first_start, period=None)
            is_multi = len(first_time) > 1
            for sym in first_time:
                sub = _extract_symbol_df(bulk, sym, is_multi)
                if sub is None:
                    failed += 1
                    continue
                n = upsert_market_data(sym, sub)
                if n > 0:
                    succeeded += 1
                else:
                    failed += 1
        except Exception as e:
            print(f"  ❌ bulk first-time fetch failed: {e}")
            failed += len(first_time)

    # 2) 증분
    if incremental:
        earliest_last = min(last_dates[s] for s in incremental)
        start_dt = (earliest_last + timedelta(days=1)).date()
        if start_dt >= today.date():
            # 이미 최신 — 오늘 종가도 없으면 건너뜀
            succeeded += len(incremental)
            return succeeded, failed
        start = start_dt.isoformat()
        print(f"  ⤓ incremental from {start} × {len(incremental)}")
        try:
            bulk = bulk_fetch(incremental, start=start, period=None)
            is_multi = len(incremental) > 1
            for sym in incremental:
                sub = _extract_symbol_df(bulk, sym, is_multi)
                if sub is None:
                    # 증분 데이터 없음 = 이미 최신
                    succeeded += 1
                    continue
                # 종목별 last_date 이후 행만
                sub = sub[sub.index > last_dates[sym]]
                if sub.empty:
                    succeeded += 1
                    continue
                n = upsert_market_data(sym, sub)
                succeeded += 1 if n > 0 else 0
        except Exception as e:
            print(f"  ❌ bulk incremental fetch failed: {e}")
            failed += len(incremental)

    return succeeded, failed


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Bulk ingest US equities via yfinance")
    parser.add_argument(
        "--tickers-file",
        help="티커 리스트 파일 (줄당 1개). 지정하면 --universe는 무시됨",
    )
    parser.add_argument(
        "--universe",
        default="all-us",
        help=(
            "수집할 유니버스: sp500 / nasdaq100 / russell1000 / russell2000 / russell3000 / "
            "watchlist / kospi200 / kosdaq150 / krx350 / all-us (기본: R1000∪R2000∪NDX100+SPY)"
        ),
    )
    parser.add_argument("--limit", type=int, help="처음 N개 종목만 테스트")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--sleep", type=float, default=DEFAULT_SLEEP, help="배치 사이 대기 초")
    parser.add_argument(
        "--years", type=int, default=DEFAULT_YEARS, help="히스토리 연수 (기본 10, 최소 권장 5)"
    )
    parser.add_argument("--skip-factors", action="store_true", help="factor precompute 스킵")
    parser.add_argument(
        "--cleanup-only",
        action="store_true",
        help="수집은 건너뛰고, 유니버스 외 symbol 데이터만 DB에서 삭제",
    )
    parser.add_argument(
        "--cleanup-before",
        action="store_true",
        help="수집 전 유니버스 외 symbol 데이터를 먼저 정리",
    )
    args = parser.parse_args()

    start_ts = time.time()
    first_start = (datetime.now(timezone.utc) - timedelta(days=365 * args.years)).date().isoformat()
    print(f"📅 History start: {first_start} (~{args.years}y)")

    # 회사명 맵 로드 — iShares Name + Wikipedia Security/Company 통합
    global _NAME_MAP
    try:
        _NAME_MAP = get_company_names_map()
    except Exception as e:
        print(f"⚠️ Name map load failed ({e}); falling back to ticker-as-name")
        _NAME_MAP = {}

    # 1. 티커 리스트 결정: --tickers-file > --universe
    if args.tickers_file:
        tickers = load_tickers_from_file(args.tickers_file)
        print(f"📄 Loaded {len(tickers)} tickers from {args.tickers_file}")
    elif args.universe == "all-us":
        tickers = get_bulk_ingest_universe()
        print(f"🇺🇸 Universe: all-us ({len(tickers)} symbols)")
    else:
        tickers = list(dict.fromkeys(get_universe(args.universe)))
        print(f"🗂  Universe: {args.universe} ({len(tickers)} symbols)")

    if args.limit:
        tickers = tickers[: args.limit]
        print(f"   → limited to first {len(tickers)}")

    # 2a. Cleanup: 유니버스 밖 symbol 제거
    if args.cleanup_only or args.cleanup_before:
        cleanup_non_universe(tickers)
        if args.cleanup_only:
            print(f"\n✅ Cleanup only mode — done in {time.time() - start_ts:.1f}s")
            return

    # 2. DB 상태 조회
    print(f"\n📚 Checking existing data for {len(tickers)} symbols...")
    last_dates = get_last_dates(tickers)
    print(f"   → {len(last_dates)} symbols already have data")
    print(f"   → {len(tickers) - len(last_dates)} need first-time fetch")

    # 3. Bulk 수집 — 국내/미국 분리 후 각각의 로직으로
    today = datetime.now(timezone.utc)
    kr_tickers = [t for t in tickers if is_krx_symbol(t)]
    us_tickers = [t for t in tickers if not is_krx_symbol(t)]
    if kr_tickers:
        print(f"   🇰🇷 KRX: {len(kr_tickers)} · 🇺🇸 US: {len(us_tickers)}")

    batches: List[tuple[str, List[str]]] = []
    for i in range(0, len(us_tickers), args.batch_size):
        batches.append(("us", us_tickers[i : i + args.batch_size]))
    for i in range(0, len(kr_tickers), args.batch_size):
        batches.append(("kr", kr_tickers[i : i + args.batch_size]))

    total_succeeded = 0
    total_failed = 0

    print(f"\n🚀 Ingesting in {len(batches)} batches (size {args.batch_size})\n")
    for i, (market, batch) in enumerate(batches):
        batch_start = time.time()
        print(f"[{i+1}/{len(batches)}] {market.upper()} · {len(batch)} symbols")
        try:
            if market == "kr":
                s, f = process_krx_batch(batch, last_dates, today, first_start)
            else:
                s, f = process_batch(batch, last_dates, today, first_start)
            total_succeeded += s
            total_failed += f
        except Exception as e:
            print(f"  ❌ batch error: {e}")
            total_failed += len(batch)

        elapsed = time.time() - start_ts
        remaining = len(batches) - i - 1
        if remaining > 0:
            eta = (elapsed / (i + 1)) * remaining
            print(f"  ⏱ batch {time.time() - batch_start:.1f}s · total {elapsed:.0f}s · ETA {eta/60:.1f}min")
        time.sleep(args.sleep)

    print(f"\n✅ Ingest done: {total_succeeded} ok, {total_failed} failed, {time.time() - start_ts:.0f}s")

    # 4. Factor precompute
    if args.skip_factors:
        print("\n⏭ Skipping factor computation")
        return

    print(f"\n📊 Computing factors for {len(tickers)} symbols...")
    fac_start = time.time()
    fac_ok = 0
    fac_fail = 0
    total = len(tickers)
    progress_every = 50
    for i, sym in enumerate(tickers):
        try:
            n = compute_factors_for_symbol(sym)
            if n > 0:
                fac_ok += 1
        except Exception as e:
            fac_fail += 1
            print(f"  ⚠️ factor {sym}: {e}")
        if (i + 1) % progress_every == 0 or (i + 1) == total:
            elapsed = time.time() - fac_start
            pct = (i + 1) / total * 100
            eta = (elapsed / (i + 1)) * (total - i - 1) if i + 1 < total else 0
            print(
                f"  [{i + 1}/{total}] {pct:.1f}% · last: {sym} · {elapsed:.0f}s · ETA {eta/60:.1f}min"
            )
    print(f"✅ Factors done: {fac_ok} ok, {fac_fail} fail, {time.time() - fac_start:.0f}s")

    print(f"\n🎉 All done in {time.time() - start_ts:.0f}s")


if __name__ == "__main__":
    main()
