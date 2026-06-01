"""
SEC EDGAR XBRL API 클라이언트 — 미국 상장사 분기 재무제표 수집.

API 문서: https://www.sec.gov/about/developer-resources
CompanyFacts: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json

무료, API 키 불필요. User-Agent 헤더만 필수.
rate limit: 10 req/s per IP.
"""

from __future__ import annotations

import time as _time
from typing import Any, Dict, List, Optional

import pandas as pd
import requests

_EDGAR_BASE = "https://data.sec.gov"
_UA = "QuantPlatform/1.0 (dongho@example.com)"
_HEADERS = {"User-Agent": _UA, "Accept": "application/json"}
_CALL_INTERVAL_SEC = 0.12  # 10 req/s 한도 → 여유있게 0.12s

# ticker → CIK 매핑 캐시
_TICKER_CIK_MAP: Optional[Dict[str, int]] = None


def _load_ticker_cik_map() -> Dict[str, int]:
    """SEC company_tickers.json에서 {TICKER: CIK} 매핑 로드 (1회 캐시)."""
    global _TICKER_CIK_MAP
    if _TICKER_CIK_MAP is not None:
        return _TICKER_CIK_MAP

    url = "https://www.sec.gov/files/company_tickers.json"
    r = requests.get(url, headers=_HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()
    # data: {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc"}, ...}
    _TICKER_CIK_MAP = {v["ticker"].upper(): v["cik_str"] for v in data.values()}
    print(f"   📋 Loaded {len(_TICKER_CIK_MAP)} SEC ticker→CIK mappings")
    return _TICKER_CIK_MAP


def get_cik(ticker: str) -> Optional[int]:
    """티커 → CIK 변환. 없으면 None."""
    m = _load_ticker_cik_map()
    # yfinance 티커는 하이픈(BRK-B), SEC는 슬래시 or 없음
    clean = ticker.upper().replace("-", "")
    return m.get(ticker.upper()) or m.get(clean)


def _fetch_company_facts(cik: int) -> Dict[str, Any]:
    """CompanyFacts JSON 전체 반환."""
    padded = str(cik).zfill(10)
    url = f"{_EDGAR_BASE}/api/xbrl/companyfacts/CIK{padded}.json"
    _time.sleep(_CALL_INTERVAL_SEC)
    r = requests.get(url, headers=_HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


# us-gaap 태그 → 우리 컬럼 매핑. 회사마다 다른 태그를 쓸 수 있어 fallback 포함.
_CONCEPT_MAP = {
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
    ],
    "operating_income": [
        "OperatingIncomeLoss",
    ],
    "net_income": [
        "NetIncomeLoss",
        "ProfitLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
    ],
    "total_assets": [
        "Assets",
    ],
    "total_equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    "total_liabilities": [
        "Liabilities",
        "LiabilitiesAndStockholdersEquity",  # fallback: A = L + E 에서 L 추정
    ],
    "eps_basic": [
        "EarningsPerShareBasic",
    ],
}


def _extract_quarterly_facts(
    facts: Dict[str, Any], concept_tags: List[str], taxonomy: str = "us-gaap"
) -> pd.DataFrame:
    """CompanyFacts JSON에서 특정 concept의 분기별(10-Q + 10-K) 값 추출.

    반환: DataFrame[fiscal_quarter(date), value]
    """
    tax_facts = facts.get("facts", {}).get(taxonomy, {})
    for tag in concept_tags:
        concept = tax_facts.get(tag)
        if concept is None:
            continue
        units = concept.get("units", {})
        # 금액은 USD, EPS는 USD/shares
        unit_data = units.get("USD") or units.get("USD/shares")
        if not unit_data:
            continue

        rows = []
        for item in unit_data:
            form = item.get("form", "")
            if form not in ("10-K", "10-Q"):
                continue
            # 분기 데이터만 (duration ~91일 or instant)
            end_date = item.get("end")
            val = item.get("val")
            if end_date is None or val is None:
                continue
            # duration 지표: 연간(10-K)은 fp="FY", 분기는 fp="Q1"~"Q4"
            fp = item.get("fp", "")
            # 연간 누적(FY)도 포함 — fundamental_factors에서 TTM으로 활용
            rows.append({"fiscal_quarter": end_date, "value": val, "fp": fp, "form": form})

        if rows:
            df = pd.DataFrame(rows)
            df["fiscal_quarter"] = pd.to_datetime(df["fiscal_quarter"])
            # 같은 end date에 여러 filing이면 최신(마지막) 것 사용
            df = df.drop_duplicates(subset=["fiscal_quarter", "fp"], keep="last")
            return df[["fiscal_quarter", "value", "fp", "form"]]

    return pd.DataFrame(columns=["fiscal_quarter", "value", "fp", "form"])


def fetch_fundamentals_for_symbol(ticker: str) -> Optional[pd.DataFrame]:
    """단일 미국 종목의 분기 재무제표를 SEC EDGAR에서 수집.

    반환: DataFrame[symbol, fiscal_quarter, revenue, operating_income, net_income,
                     total_assets, total_equity, total_liabilities, eps_basic]
    없으면 None.
    """
    cik = get_cik(ticker)
    if cik is None:
        return None

    try:
        facts = _fetch_company_facts(cik)
    except Exception as e:
        print(f"    ❌ EDGAR {ticker} (CIK={cik}): {e}")
        return None

    result_frames = {}
    for col_name, tags in _CONCEPT_MAP.items():
        # 태그 순회: 가장 최근 FY 데이터를 가진 태그 채택 (동일 시 건수 우선)
        best_series = None
        best_max_date = pd.Timestamp.min
        best_count = 0
        for tag in tags:
            df = _extract_quarterly_facts(facts, [tag])
            if df.empty:
                continue
            fy = df[df["fp"] == "FY"].copy()
            if fy.empty:
                continue
            max_date = fy["fiscal_quarter"].max()
            if max_date > best_max_date or (max_date == best_max_date and len(fy) > best_count):
                best_max_date = max_date
                best_count = len(fy)
                best_series = fy.set_index("fiscal_quarter")["value"]
        if best_series is not None:
            result_frames[col_name] = best_series

    if not result_frames:
        return None

    combined = pd.DataFrame(result_frames)
    if combined.empty:
        return None

    combined.index.name = "fiscal_quarter"
    combined = combined.reset_index()
    combined["symbol"] = ticker
    combined["fiscal_quarter"] = combined["fiscal_quarter"].dt.date

    # eps_basic은 float (달러), 나머지는 BIGINT로 캐스팅
    int_cols = [
        "revenue",
        "operating_income",
        "net_income",
        "total_assets",
        "total_equity",
        "total_liabilities",
    ]
    for c in int_cols:
        if c in combined.columns:
            combined[c] = pd.to_numeric(combined[c], errors="coerce").astype("Int64")

    return combined[
        ["symbol", "fiscal_quarter"] + [c for c in _CONCEPT_MAP if c in combined.columns]
    ]


def save_edgar_to_db(df: pd.DataFrame) -> int:
    """SEC EDGAR에서 파싱된 DataFrame을 fundamental_data 테이블에 upsert."""
    from sqlalchemy import text as sa_text
    from src.core.database import engine as db_engine

    if df.empty:
        return 0

    import math

    # SQL에 필요한 모든 컬럼이 dict에 있어야 함 — 누락 시 None으로 채움
    required_cols = [
        "symbol",
        "fiscal_quarter",
        "revenue",
        "operating_income",
        "net_income",
        "total_assets",
        "total_equity",
        "total_liabilities",
        "eps_basic",
    ]
    rows = df.where(df.notna(), None).to_dict(orient="records")
    for r in rows:
        # 누락 컬럼 None 보충
        for col in required_cols:
            if col not in r:
                r[col] = None
        # nan/inf → None
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None

    with db_engine.begin() as conn:
        for r in rows:
            # stocks 행 보장 (FK 충족)
            conn.execute(
                sa_text(
                    "INSERT INTO stocks (symbol, name) VALUES (:s, :s) "
                    "ON CONFLICT (symbol) DO NOTHING"
                ),
                {"s": r["symbol"]},
            )
            conn.execute(
                sa_text(
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
                r,
            )
    return len(rows)


def ingest_us_fundamentals(tickers: list[str]) -> dict[str, int]:
    """미국 종목 일괄 SEC EDGAR 펀더멘털 수집 + DB 적재."""
    import time

    ok, fail, skip = 0, 0, 0
    total = len(tickers)
    progress_every = 50

    print(f"📥 SEC EDGAR 펀더멘털 수집: {total}개 종목")
    started = time.time()

    for i, ticker in enumerate(tickers):
        try:
            df = fetch_fundamentals_for_symbol(ticker)
            if df is None or df.empty:
                skip += 1
                continue
            n = save_edgar_to_db(df)
            if n > 0:
                ok += 1
            else:
                skip += 1
        except Exception as e:
            fail += 1
            print(f"  ⚠️ EDGAR {ticker}: {e}")

        if (i + 1) % progress_every == 0 or (i + 1) == total:
            elapsed = time.time() - started
            pct = (i + 1) / total * 100
            eta = (elapsed / (i + 1)) * (total - i - 1) if i + 1 < total else 0
            print(
                f"  [{i + 1}/{total}] {pct:.1f}% · {ok} ok · {elapsed:.0f}s · ETA {eta / 60:.1f}min"
            )

    print(f"✅ EDGAR done: {ok} ok, {fail} fail, {skip} skip, {time.time() - started:.0f}s")
    return {"ok": ok, "fail": fail, "skip": skip}
