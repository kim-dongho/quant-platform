"""펀더멘털 도메인 — DART(한국) + SEC EDGAR(미국) 분기 재무제표 수집·저장 + 일별 factor 계산."""

from src.service.fundamental.dart_client import (
    fetch_corp_code_list,
    fetch_financial_statement,
    parse_financials,
)
from src.service.fundamental.edgar_client import (
    fetch_fundamentals_for_symbol,
    ingest_us_fundamentals,
    save_edgar_to_db,
)
from src.service.fundamental.factors import (
    FUNDAMENTAL_FACTOR_COLUMNS,
    backfill as backfill_factors,
    compute_fundamental_factors,
    save_fundamental_factors,
)
from src.service.fundamental.ingest import (
    backfill,
    get_corp_code,
    ingest_quarter,
    sync_corp_codes,
)

__all__ = [
    "fetch_corp_code_list",
    "fetch_financial_statement",
    "parse_financials",
    "sync_corp_codes",
    "get_corp_code",
    "ingest_quarter",
    "backfill",
    "FUNDAMENTAL_FACTOR_COLUMNS",
    "compute_fundamental_factors",
    "save_fundamental_factors",
    "backfill_factors",
    "fetch_fundamentals_for_symbol",
    "save_edgar_to_db",
    "ingest_us_fundamentals",
]
