"""
펀더멘털 재무제표 ingest — DART API → DB.

흐름:
  1) sync_corp_codes() — corp_code 매핑 한 번 받아 DB 캐시 (재실행 시 skip)
  2) ingest_quarter(symbol, year, quarter) — 단일 호출로 DB 저장
  3) backfill(symbols, years) — N 종목 × N 년 × 4 분기 일괄 처리

분기말 매핑:
  Q1 → 03-31, Q2 → 06-30, Q3 → 09-30, Q4 → 12-31
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from src.core.database import engine
from src.service.fundamental.dart_client import (
    fetch_corp_code_list,
    fetch_financial_statement,
    parse_financials,
)

QUARTER_END_MONTH_DAY = {"Q1": (3, 31), "Q2": (6, 30), "Q3": (9, 30), "Q4": (12, 31)}


# ---------------------------------------------------------------------------
# corp_code 매핑 동기화
# ---------------------------------------------------------------------------
def _krx_to_symbol(stock_code: str, kospi_codes: set, kosdaq_codes: set) -> Optional[str]:
    """6자리 KRX 코드 → DB 의 .KS / .KQ 형식 symbol. 매칭 안 되면 None."""
    if stock_code in kospi_codes:
        return f"{stock_code}.KS"
    if stock_code in kosdaq_codes:
        return f"{stock_code}.KQ"
    return None


def sync_corp_codes(stocks_only: bool = True) -> int:
    """DART corp_code 전체 다운로드 → corp_codes 테이블 upsert.

    stocks_only=True 면 stocks 테이블에 있는 종목만 매핑 (대부분 케이스).
    반환: 저장된 row 수.
    """
    print("📥 DART corp_code 목록 다운로드 중...")
    all_corps = fetch_corp_code_list()
    print(f"   → 총 {len(all_corps)}개 corp 수신")

    # stocks 테이블에서 6자리 코드 → suffix 매핑 만들기
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT symbol FROM stocks")).all()
    db_symbols = {r[0] for r in rows}
    kospi_codes = {s.split(".")[0] for s in db_symbols if s.endswith(".KS")}
    kosdaq_codes = {s.split(".")[0] for s in db_symbols if s.endswith(".KQ")}

    saved = 0
    with engine.begin() as conn:
        for c in all_corps:
            stock_code = c["stock_code"]
            if not stock_code:
                continue  # 비상장사
            symbol = _krx_to_symbol(stock_code, kospi_codes, kosdaq_codes)
            if stocks_only and symbol is None:
                continue
            if symbol is None:
                continue  # stocks 에 없으면 일단 skip
            conn.execute(
                text(
                    """
                    INSERT INTO corp_codes (symbol, corp_code, corp_name, stock_code, updated_at)
                    VALUES (:symbol, :corp_code, :corp_name, :stock_code, now())
                    ON CONFLICT (symbol) DO UPDATE SET
                        corp_code  = EXCLUDED.corp_code,
                        corp_name  = EXCLUDED.corp_name,
                        stock_code = EXCLUDED.stock_code,
                        updated_at = now()
                    """
                ),
                {
                    "symbol": symbol,
                    "corp_code": c["corp_code"],
                    "corp_name": c["corp_name"],
                    "stock_code": stock_code,
                },
            )
            saved += 1
    print(f"✅ corp_codes 매핑 저장: {saved}개")
    return saved


def get_corp_code(symbol: str) -> Optional[str]:
    """symbol → corp_code 조회. 없으면 None."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT corp_code FROM corp_codes WHERE symbol = :s"),
            {"s": symbol},
        ).fetchone()
    return row[0] if row else None


# ---------------------------------------------------------------------------
# 분기 재무제표 ingest
# ---------------------------------------------------------------------------
def _fiscal_quarter_date(year: int, quarter: str) -> date:
    m, d = QUARTER_END_MONTH_DAY[quarter]
    return date(year, m, d)


def ingest_quarter(
    symbol: str,
    year: int,
    quarter: str,
    corp_code: Optional[str] = None,
) -> bool:
    """단일 종목·분기 재무제표 fetch → DB upsert.

    반환: True=저장됨, False=API 데이터 없음 (분기 미보고 등).
    """
    if corp_code is None:
        corp_code = get_corp_code(symbol)
        if not corp_code:
            print(f"  ⚠️ {symbol} corp_code 매핑 없음 — sync_corp_codes 먼저 실행")
            return False

    items = fetch_financial_statement(corp_code, year, quarter)
    if items is None:
        return False  # status 013 — 데이터 없음
    parsed = parse_financials(items)
    if all(v is None for v in parsed.values()):
        return False  # 모든 field 파싱 실패

    fq = _fiscal_quarter_date(year, quarter)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO fundamental_data (
                    symbol, fiscal_quarter,
                    revenue, operating_income, net_income,
                    total_assets, total_equity, total_liabilities,
                    eps_basic, ingested_at
                ) VALUES (
                    :symbol, :fiscal_quarter,
                    :revenue, :operating_income, :net_income,
                    :total_assets, :total_equity, :total_liabilities,
                    :eps_basic, now()
                )
                ON CONFLICT (symbol, fiscal_quarter) DO UPDATE SET
                    revenue           = EXCLUDED.revenue,
                    operating_income  = EXCLUDED.operating_income,
                    net_income        = EXCLUDED.net_income,
                    total_assets      = EXCLUDED.total_assets,
                    total_equity      = EXCLUDED.total_equity,
                    total_liabilities = EXCLUDED.total_liabilities,
                    eps_basic         = EXCLUDED.eps_basic,
                    ingested_at       = now()
                """
            ),
            {"symbol": symbol, "fiscal_quarter": fq, **parsed},
        )
    return True


def _existing_quarters(symbols: List[str]) -> set:
    """이미 저장된 (symbol, fiscal_quarter) set 반환."""
    if not symbols:
        return set()
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT symbol, fiscal_quarter FROM fundamental_data WHERE symbol = ANY(:s)"),
            {"s": symbols},
        ).all()
    return {(r[0], r[1]) for r in rows}


def _latest_quarter_per_symbol(symbols: List[str]) -> Dict[str, date]:
    """종목별 최근 fiscal_quarter dict 반환 (refresh-latest 용)."""
    if not symbols:
        return {}
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT symbol, MAX(fiscal_quarter) AS latest
                FROM fundamental_data
                WHERE symbol = ANY(:s)
                GROUP BY symbol
                """
            ),
            {"s": symbols},
        ).all()
    return {r[0]: r[1] for r in rows}


def _date_to_year_quarter(d: date) -> tuple[int, str]:
    """YYYY-MM-DD → (year, 'Q1'/'Q2'/'Q3'/'Q4')."""
    q = (d.month - 1) // 3 + 1
    return d.year, f"Q{q}"


def backfill(
    symbols: List[str],
    years: List[int],
    progress: bool = True,
    missing_only: bool = False,
    refresh_latest: bool = False,
) -> Dict[str, Any]:
    """다중 종목·다중 연도 일괄 ingest.

    missing_only=True 면 DB 에 이미 있는 (symbol, fiscal_quarter) 는 건너뜀
        → 매월 cron 으로 신규 분기 보고서만 수집할 때 사용.

    refresh_latest=True 면 종목별 최신 분기는 항상 re-fetch
        → 재무제표 정정 (restatement) 반영.

    반환: {ok, skipped, errors, total, fetch_attempts}
    """
    quarters = ["Q1", "Q2", "Q3", "Q4"]
    total = len(symbols) * len(years) * 4
    ok = 0
    skipped = 0
    errors = 0
    done = 0
    fetch_attempts = 0

    # corp_code 한 번에 조회 (반복 SELECT 회피)
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT symbol, corp_code FROM corp_codes WHERE symbol = ANY(:syms)"),
            {"syms": symbols},
        ).all()
    code_map = {r[0]: r[1] for r in rows}

    # incremental 보조 데이터
    existing = _existing_quarters(symbols) if missing_only else set()
    latest_map = _latest_quarter_per_symbol(symbols) if refresh_latest else {}
    # 분기 마감 후 180일이면 보고서 완전히 들어왔어야 함 — 그래도 결손이면 영구 결손
    # (상장폐지 / 합병 / DART 보고 안 한 회사). 매월 cron 에서 재호출 낭비 방지.
    permanent_missing_cutoff = date.today() - timedelta(days=180)

    for sym in symbols:
        cc = code_map.get(sym)
        if not cc:
            skipped += 4 * len(years)
            done += 4 * len(years)
            if progress:
                print(f"  ⚠️ {sym} corp_code 없음 — sync_corp_codes 먼저 실행")
            continue
        for y in years:
            for q in quarters:
                done += 1
                fq = _fiscal_quarter_date(y, q)
                # missing_only: 이미 있는 분기는 skip — 단 refresh_latest 가 켜져 있고
                # 그게 종목 최신 분기면 강제 re-fetch.
                if missing_only and (sym, fq) in existing:
                    is_latest = refresh_latest and latest_map.get(sym) == fq
                    if not is_latest:
                        skipped += 1
                        continue
                # missing_only 인데 fq 가 영구 결손 추정이면 skip (180일 경과 + DB 없음)
                if missing_only and (sym, fq) not in existing and fq < permanent_missing_cutoff:
                    skipped += 1
                    continue
                try:
                    fetch_attempts += 1
                    saved = ingest_quarter(sym, y, q, corp_code=cc)
                    if saved:
                        ok += 1
                    else:
                        skipped += 1
                except Exception as e:
                    errors += 1
                    print(f"  ❌ {sym} {y}{q}: {e}")
                if progress and done % 50 == 0:
                    print(
                        f"  [{done}/{total}] ok={ok} skipped={skipped} "
                        f"errors={errors} fetched={fetch_attempts}"
                    )
    return {
        "ok": ok,
        "skipped": skipped,
        "errors": errors,
        "total": total,
        "fetch_attempts": fetch_attempts,
    }
