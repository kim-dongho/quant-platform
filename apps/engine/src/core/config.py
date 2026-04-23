import os
from functools import lru_cache
from typing import Dict, List

# DB 접속 정보
DB_URL = os.getenv("DB_DSN", "postgresql://user:password@db:5432/quant")

# ---------------------------------------------------------------------------
# 개인 Watchlist — 하드코딩된 테마 종목 (유지)
# ---------------------------------------------------------------------------
WATCHLIST: List[str] = [
    # 우주/모빌리티
    "RKLB", "ASTS", "LUNR", "RDW", "SPCE", "JOBY", "ACHR",
    # AI/양자
    "PLTR", "IONQ", "QUBT", "BBAI", "SMCI", "RGTI",
    # 반도체
    "NVDA", "AMD", "ARM", "TSM", "AVGO", "MU", "SNDK",
    # 코인/핀테크
    "MSTR", "COIN", "HOOD",
    # 빅테크/EV
    "TSLA", "RIVN", "LCID", "AAPL", "MSFT", "GOOGL", "META",
]

# 기존 코드 호환성용 alias
TARGET_TICKERS = WATCHLIST


# ---------------------------------------------------------------------------
# S&P 500 / NASDAQ 100 — Wikipedia 테이블에서 동적 파싱
# ---------------------------------------------------------------------------
def _normalize_ticker(sym: str) -> str:
    """Wikipedia 표기를 yfinance 표기로 변환 (예: BRK.B → BRK-B)."""
    return sym.strip().replace(".", "-").upper()


def _fetch_wiki_html(url: str) -> str:
    """Wikipedia는 User-Agent 없는 요청을 403 거부. requests로 UA 붙여서 가져옴."""
    import requests

    r = requests.get(
        url,
        timeout=30,
        headers={"User-Agent": "QuantPlatform/1.0 (github.com/kim-dongho/quant-platform)"},
    )
    r.raise_for_status()
    return r.text


@lru_cache(maxsize=1)
def fetch_sp500() -> List[str]:
    """Wikipedia의 'List of S&P 500 companies' 테이블에서 500개 티커 추출."""
    import pandas as pd
    from io import StringIO

    print("📥 Fetching S&P 500 constituents from Wikipedia...")
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    html = _fetch_wiki_html(url)
    tables = pd.read_html(StringIO(html))
    # 첫 테이블이 현재 구성, 컬럼명은 'Symbol'
    df = tables[0]
    symbols = df["Symbol"].astype(str).tolist()
    result = sorted({_normalize_ticker(s) for s in symbols if s})
    print(f"   → {len(result)} S&P 500 symbols")
    return result


@lru_cache(maxsize=1)
def fetch_nasdaq100() -> List[str]:
    """Wikipedia의 'Nasdaq-100' 테이블에서 100개 티커 추출."""
    import pandas as pd
    from io import StringIO

    print("📥 Fetching NASDAQ 100 constituents from Wikipedia...")
    url = "https://en.wikipedia.org/wiki/Nasdaq-100"
    html = _fetch_wiki_html(url)
    tables = pd.read_html(StringIO(html))
    # 구성 종목 테이블 찾기 (Ticker 또는 Symbol 컬럼 존재)
    for t in tables:
        cols = set(map(str, t.columns))
        if "Ticker" in cols:
            result = sorted({_normalize_ticker(s) for s in t["Ticker"].astype(str).tolist() if s})
            print(f"   → {len(result)} NASDAQ 100 symbols")
            return result
        if "Symbol" in cols:
            result = sorted({_normalize_ticker(s) for s in t["Symbol"].astype(str).tolist() if s})
            print(f"   → {len(result)} NASDAQ 100 symbols")
            return result
    raise RuntimeError("Could not find NASDAQ 100 components table on Wikipedia")


def _parse_csv_row(line: str) -> List[str]:
    """쉼표 구분 한 줄을 필드로 분할하되 큰따옴표 내부의 쉼표는 보호."""
    import csv
    from io import StringIO

    return next(csv.reader(StringIO(line)))


def _fetch_ishares_holdings_raw(url: str, etf_name: str, retries: int = 3) -> List[Dict[str, str]]:
    """iShares ETF holdings CSV에서 [{'ticker': ..., 'name': ...}, ...] 형태로 파싱."""
    import time as _time

    import requests

    print(f"📥 Fetching {etf_name} holdings from iShares...")
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            break
        except requests.exceptions.RequestException as e:
            last_err = e
            if attempt < retries:
                wait = 2 ** attempt
                print(f"   ⚠️ attempt {attempt} failed ({e}); retrying in {wait}s...")
                _time.sleep(wait)
            else:
                raise RuntimeError(f"Failed to fetch {etf_name} after {retries} attempts") from last_err

    lines = r.text.splitlines()
    header_idx = next((i for i, line in enumerate(lines) if line.startswith("Ticker,")), None)
    if header_idx is None:
        raise RuntimeError(f"Could not locate 'Ticker' header in {etf_name} CSV")

    header_cols = _parse_csv_row(lines[header_idx])
    ticker_i = header_cols.index("Ticker") if "Ticker" in header_cols else 0
    name_i = header_cols.index("Name") if "Name" in header_cols else 1

    rows: List[Dict[str, str]] = []
    for line in lines[header_idx + 1:]:
        if not line.strip():
            break
        try:
            fields = _parse_csv_row(line)
        except Exception:
            continue
        if len(fields) <= max(ticker_i, name_i):
            continue
        ticker = fields[ticker_i].strip().strip('"')
        name = fields[name_i].strip().strip('"') if name_i < len(fields) else ""
        if not ticker:
            continue
        cleaned = ticker.replace("-", "").replace(".", "")
        if 1 <= len(ticker) <= 5 and cleaned.isalnum():
            rows.append({"ticker": _normalize_ticker(ticker), "name": name})
    return rows


def _fetch_ishares_etf_holdings(url: str, etf_name: str, retries: int = 3) -> List[str]:
    """iShares ETF 공식 holdings CSV에서 종목 티커 추출 (기존 API 유지)."""
    rows = _fetch_ishares_holdings_raw(url, etf_name, retries)
    result = sorted({r["ticker"] for r in rows})
    print(f"   → {len(result)} {etf_name} symbols")
    return result


@lru_cache(maxsize=1)
def fetch_russell1000() -> List[str]:
    """iShares IWB ETF (Russell 1000 대형주 추종) holdings CSV."""
    url = (
        "https://www.ishares.com/us/products/239707/ishares-russell-1000-etf/"
        "?fileType=csv&fileName=IWB_holdings&dataType=fund"
    )
    return _fetch_ishares_etf_holdings(url, "Russell 1000 (IWB)")


@lru_cache(maxsize=1)
def fetch_russell2000() -> List[str]:
    """iShares IWM ETF (Russell 2000 소형주 추종) holdings CSV."""
    url = (
        "https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/"
        "?fileType=csv&fileName=IWM_holdings&dataType=fund"
    )
    return _fetch_ishares_etf_holdings(url, "Russell 2000 (IWM)")


def fetch_russell3000() -> List[str]:
    """Russell 3000 = Russell 1000 ∪ Russell 2000 (별도 API 호출 불필요)."""
    return sorted(set(fetch_russell1000()) | set(fetch_russell2000()))


# ---------------------------------------------------------------------------
# KRX (국내) — FinanceDataReader 기반, 시총 상위 N개로 KOSPI 200 / KOSDAQ 150 근사
# ---------------------------------------------------------------------------
def _krx_symbol(code: str, market_suffix: str) -> str:
    """FDR Code + 시장 접미사 → DB 저장용 symbol. 예: 005930, 'KS' → '005930.KS'."""
    return f"{code}.{market_suffix}"


@lru_cache(maxsize=1)
def _load_krx_listing():
    """KOSPI + KOSDAQ 전체 상장 종목 스냅샷 (Code / Name / Marcap / _MARKET)."""
    import FinanceDataReader as fdr
    import pandas as pd

    print("📥 Fetching KRX listings (KOSPI + KOSDAQ) from FinanceDataReader...")
    kospi = fdr.StockListing("KOSPI").copy()
    kospi["_MARKET"] = "KS"
    kosdaq = fdr.StockListing("KOSDAQ").copy()
    kosdaq["_MARKET"] = "KQ"

    keep = ["Code", "Name", "Marcap", "_MARKET"]
    combined = pd.concat([kospi[keep], kosdaq[keep]], ignore_index=True)
    # 6자리 숫자 코드만 (일부 특수 종목/ETF는 다른 포맷) + 시총 있는 것만
    combined = combined[combined["Code"].str.match(r"^\d{6}$", na=False)]
    combined = combined.dropna(subset=["Marcap"])
    return combined


@lru_cache(maxsize=1)
def fetch_kospi200() -> List[str]:
    """KOSPI 시총 상위 200종목 (공식 KOSPI 200의 시총 근사치 — 유동주식 가중 등 세부 차이 있음)."""
    df = _load_krx_listing()
    kospi = df[df["_MARKET"] == "KS"].sort_values("Marcap", ascending=False).head(200)
    result = sorted({_krx_symbol(str(c), "KS") for c in kospi["Code"]})
    print(f"   → {len(result)} KOSPI 200 (top cap) symbols")
    return result


@lru_cache(maxsize=1)
def fetch_kosdaq150() -> List[str]:
    """KOSDAQ 시총 상위 150종목 (KOSDAQ 150의 시총 근사치)."""
    df = _load_krx_listing()
    kosdaq = df[df["_MARKET"] == "KQ"].sort_values("Marcap", ascending=False).head(150)
    result = sorted({_krx_symbol(str(c), "KQ") for c in kosdaq["Code"]})
    print(f"   → {len(result)} KOSDAQ 150 (top cap) symbols")
    return result


def fetch_krx350() -> List[str]:
    """KOSPI 200 ∪ KOSDAQ 150 — 국내 대형주 통합 유니버스."""
    return sorted(set(fetch_kospi200()) | set(fetch_kosdaq150()))


def is_krx_symbol(symbol: str) -> bool:
    """symbol이 한국 종목인지 (.KS / .KQ 접미사)."""
    return symbol.endswith(".KS") or symbol.endswith(".KQ")


# ---------------------------------------------------------------------------
# Universe lookup — 통일된 진입점
# ---------------------------------------------------------------------------
UNIVERSE_NAMES = {
    "watchlist",
    "sp500",
    "nasdaq100",
    "russell1000",
    "russell2000",
    "russell3000",
    "kospi200",
    "kosdaq150",
    "krx350",
}


def get_universe(name: str) -> List[str]:
    if name == "watchlist":
        return list(WATCHLIST)
    if name == "sp500":
        return fetch_sp500()
    if name == "nasdaq100":
        return fetch_nasdaq100()
    if name == "russell1000":
        return fetch_russell1000()
    if name == "russell2000":
        return fetch_russell2000()
    if name == "russell3000":
        return fetch_russell3000()
    if name == "kospi200":
        return fetch_kospi200()
    if name == "kosdaq150":
        return fetch_kosdaq150()
    if name == "krx350":
        return fetch_krx350()
    raise ValueError(f"Unknown universe: {name}. Allowed: {sorted(UNIVERSE_NAMES)}")


def get_bulk_ingest_universe() -> List[str]:
    """Bulk 수집 대상: Russell 1000 ∪ Russell 2000 ∪ NASDAQ 100 ∪ SPY.
    R1000 ∪ R2000 = Russell 3000 (대형 + 소형 전체). NASDAQ 100에서 R3000에 없는 외국 ADR 등 보충.
    SPY는 백테스트 벤치마크 용도."""
    combined = set(fetch_russell1000()) | set(fetch_russell2000()) | set(fetch_nasdaq100())
    combined.add("SPY")
    return sorted(combined)


@lru_cache(maxsize=1)
def get_company_names_map() -> Dict[str, str]:
    """모든 유니버스 소스에서 {ticker: company_name} 맵을 만든다.
    iShares IWB/IWM은 'Name' 컬럼, Wikipedia SP500/NASDAQ100 테이블은 'Security'/'Company' 컬럼 사용.
    중복 ticker는 먼저 들어온 값 유지.
    """
    import pandas as pd
    from io import StringIO

    name_map: Dict[str, str] = {}

    def _merge(pairs):
        for t, n in pairs:
            if not t or not n:
                continue
            name_map.setdefault(t, n)

    # 1) iShares IWB / IWM — 먼저 넣어 덮어쓰기 우선순위 확보
    try:
        iwb_url = (
            "https://www.ishares.com/us/products/239707/ishares-russell-1000-etf/"
            "?fileType=csv&fileName=IWB_holdings&dataType=fund"
        )
        rows = _fetch_ishares_holdings_raw(iwb_url, "Russell 1000 (IWB) names")
        _merge((r["ticker"], r["name"]) for r in rows)
    except Exception as e:
        print(f"   ⚠️ IWB names fetch skipped: {e}")

    try:
        iwm_url = (
            "https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/"
            "?fileType=csv&fileName=IWM_holdings&dataType=fund"
        )
        rows = _fetch_ishares_holdings_raw(iwm_url, "Russell 2000 (IWM) names")
        _merge((r["ticker"], r["name"]) for r in rows)
    except Exception as e:
        print(f"   ⚠️ IWM names fetch skipped: {e}")

    # 2) Wikipedia SP500 — 'Symbol' + 'Security'
    try:
        html = _fetch_wiki_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
        df = pd.read_html(StringIO(html))[0]
        _merge(
            (_normalize_ticker(str(s)), str(n))
            for s, n in zip(df["Symbol"], df["Security"])
        )
    except Exception as e:
        print(f"   ⚠️ SP500 Wiki names fetch skipped: {e}")

    # 3) Wikipedia NASDAQ 100 — 'Ticker' + 'Company'
    try:
        html = _fetch_wiki_html("https://en.wikipedia.org/wiki/Nasdaq-100")
        tables = pd.read_html(StringIO(html))
        for t in tables:
            cols = set(map(str, t.columns))
            if "Ticker" in cols and "Company" in cols:
                _merge(
                    (_normalize_ticker(str(s)), str(n))
                    for s, n in zip(t["Ticker"], t["Company"])
                )
                break
    except Exception as e:
        print(f"   ⚠️ NASDAQ 100 Wiki names fetch skipped: {e}")

    # 4) KRX KOSPI + KOSDAQ — Code + Name
    try:
        df = _load_krx_listing()
        _merge(
            (_krx_symbol(str(c), str(m)), str(n))
            for c, m, n in zip(df["Code"], df["_MARKET"], df["Name"])
        )
    except Exception as e:
        print(f"   ⚠️ KRX names fetch skipped: {e}")

    # 벤치마크 ETF 이름 수동 추가
    name_map.setdefault("SPY", "SPDR S&P 500 ETF Trust")
    name_map.setdefault("069500.KS", "KODEX 200")
    name_map.setdefault("229200.KQ", "KODEX 코스닥150")

    print(f"📛 Collected {len(name_map)} company names across sources")
    return name_map
