"""
일별 펀더멘털 factor 계산 — fundamental_data + market_data → fundamental_factors.

각 (symbol, trading_date) 에 대해:
  - 최신 가용 분기 재무제표를 찾아 (date 기준 backward as-of join)
  - 그날 close 와 결합해 시가총액 / 비율 계산
  - PBR, PER, ROE, 부채비율, 영업이익률, 총자산회전율 산출

look-ahead bias 방지:
  - direction="backward" 라 fiscal_quarter <= date 인 것만 사용
  - 단 보고서 공시 lag (Q1 → 5월 중순) 까지 정확히 반영하려면 +45일 추가 필요
    (prototype 에선 분기말 시점 사용 — TODO)

발행주식수:
  shares = TTM_net_income / TTM_eps_basic
  → market_cap = close × shares
  EPS 음수/0 인 종목은 PBR/PER NaN.
"""

from __future__ import annotations

from datetime import date
from typing import List, Optional

import connectorx as cx
import numpy as np
import pandas as pd
from sqlalchemy import text

from src.core.database import CONNECTORX_URL, engine

FUNDAMENTAL_FACTOR_COLUMNS = [
    "pbr",
    "per",
    "roe",
    "debt_to_equity",
    "operating_margin",
    "asset_turnover",
]


def _load_market_close(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    """market_data 의 daily close. (date, symbol, close)."""
    syms_lit = ", ".join("'" + s.replace("'", "''") + "'" for s in symbols)
    sql = f"""
        SELECT time::date AS date, symbol, close
        FROM market_data
        WHERE symbol IN ({syms_lit})
          AND time >= '{start}'::timestamptz
          AND time < ('{end}'::date + INTERVAL '1 day')
    """
    df = cx.read_sql(CONNECTORX_URL, sql, return_type="pandas")
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"])
    return df.drop_duplicates(subset=["date", "symbol"], keep="last").sort_values(
        ["symbol", "date"]
    )


def _load_fundamental(symbols: List[str]) -> pd.DataFrame:
    """fundamental_data 전체 (분기별)."""
    syms_lit = ", ".join("'" + s.replace("'", "''") + "'" for s in symbols)
    sql = f"""
        SELECT symbol, fiscal_quarter,
               revenue, operating_income, net_income,
               total_assets, total_equity, total_liabilities,
               eps_basic
        FROM fundamental_data
        WHERE symbol IN ({syms_lit})
    """
    df = cx.read_sql(CONNECTORX_URL, sql, return_type="pandas")
    if df.empty:
        return df
    df["fiscal_quarter"] = pd.to_datetime(df["fiscal_quarter"])
    return df.sort_values(["symbol", "fiscal_quarter"])


def _safe_divide(num: pd.Series, den: pd.Series) -> pd.Series:
    """0 / NaN 방어. 결과 inf 도 NaN 으로."""
    out = num / den.where(den != 0, np.nan)
    return out.replace([np.inf, -np.inf], np.nan)


def compute_fundamental_factors(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    """일별 펀더멘털 factor DataFrame 반환. 컬럼: date, symbol, + FUNDAMENTAL_FACTOR_COLUMNS.

    NaN 처리:
      - 자본 ≤ 0 → PBR/ROE NaN (자본잠식)
      - 매출 0 → 영업이익률 NaN
      - EPS 0 또는 음수 → 시가총액 산출 불가 → PBR/PER NaN
    """
    md = _load_market_close(symbols, start, end)
    fd = _load_fundamental(symbols)
    if md.empty or fd.empty:
        return pd.DataFrame(columns=["date", "symbol", *FUNDAMENTAL_FACTOR_COLUMNS])

    # connectorx 는 nullable BIGINT 을 pandas Int64 (extension dtype) 로 반환 — 곱셈/나눗셈 시
    # numpy float 와 혼합되며 LossySetitemError 발생. 처음부터 numpy float64 로 캐스팅해 호환성 확보.
    int_cols = [
        "revenue",
        "operating_income",
        "net_income",
        "total_assets",
        "total_equity",
        "total_liabilities",
        "eps_basic",
    ]
    for c in int_cols:
        if c in fd.columns:
            fd[c] = pd.to_numeric(fd[c], errors="coerce").astype("float64")

    # Balance sheet (any quarter, latest as-of date) — 분기말 어떤 거든 OK.
    bs = fd[
        ["symbol", "fiscal_quarter", "total_assets", "total_equity", "total_liabilities"]
    ].copy()

    # TTM (annual cumulative) — Q4 (12월 분기말) 만 사용.
    # 사업보고서 thstrm_amount = 연간 누적이라 그대로 TTM 으로 활용.
    ttm = fd[fd["fiscal_quarter"].dt.month == 12].copy()
    ttm = ttm[
        ["symbol", "fiscal_quarter", "revenue", "operating_income", "net_income", "eps_basic"]
    ]
    ttm = ttm.rename(
        columns={
            "fiscal_quarter": "ttm_quarter",
            "revenue": "ttm_revenue",
            "operating_income": "ttm_op_income",
            "net_income": "ttm_net_income",
            "eps_basic": "ttm_eps_basic",
        }
    )

    # As-of join (per symbol). pandas merge_asof 는 정렬 필요 + by 인자.
    md_sorted = md.sort_values("date")
    bs_sorted = bs.sort_values("fiscal_quarter")
    ttm_sorted = ttm.sort_values("ttm_quarter")

    merged = pd.merge_asof(
        md_sorted,
        bs_sorted,
        by="symbol",
        left_on="date",
        right_on="fiscal_quarter",
        direction="backward",
    )
    merged = pd.merge_asof(
        merged.sort_values("date"),
        ttm_sorted,
        by="symbol",
        left_on="date",
        right_on="ttm_quarter",
        direction="backward",
    )

    # 발행주식수 추정 — TTM_net_income / TTM_eps. eps=0만 제외 (적자도 유효).
    nonzero_eps = merged["ttm_eps_basic"] != 0
    shares = pd.Series(np.nan, index=merged.index)
    shares.loc[nonzero_eps] = (
        merged.loc[nonzero_eps, "ttm_net_income"] / merged.loc[nonzero_eps, "ttm_eps_basic"]
    ).abs()  # 적자 시 shares가 음수되는 것 방지
    market_cap = merged["close"] * shares

    # 자본총계 ≤ 0 (자본잠식) 은 PBR/ROE 무의미 → NaN
    pos_eq = merged["total_equity"].where(merged["total_equity"] > 0, np.nan)

    out = pd.DataFrame(
        {
            "date": merged["date"].dt.date,
            "symbol": merged["symbol"],
            "pbr": _safe_divide(market_cap, pos_eq),
            "per": _safe_divide(market_cap, merged["ttm_net_income"]),
            "roe": _safe_divide(merged["ttm_net_income"], pos_eq) * 100,
            "debt_to_equity": _safe_divide(merged["total_liabilities"], pos_eq) * 100,
            "operating_margin": _safe_divide(merged["ttm_op_income"], merged["ttm_revenue"]) * 100,
            "asset_turnover": _safe_divide(merged["ttm_revenue"], merged["total_assets"]),
        }
    )
    return out


def save_fundamental_factors(df: pd.DataFrame) -> int:
    """compute 결과 DataFrame 을 fundamental_factors 테이블에 upsert. 저장 row 수 반환."""
    if df.empty:
        return 0

    # 모든 factor 가 NaN 인 row 는 저장 안 함 (날짜에 fundamental 데이터가 없는 경우).
    has_any = df[FUNDAMENTAL_FACTOR_COLUMNS].notna().any(axis=1)
    df = df[has_any]
    if df.empty:
        return 0

    # NaN → None (psycopg/SQL NULL 호환)
    rows = df.replace({np.nan: None}).to_dict(orient="records")

    with engine.begin() as conn:
        # 단일 큰 INSERT 보다 chunk 로 — execute_values 같은 batch 가 깔끔하지만
        # SQLAlchemy core 로 50000 row 도 충분히 빠름.
        conn.execute(
            text(
                """
                INSERT INTO fundamental_factors (
                    time, symbol, pbr, per, roe, debt_to_equity,
                    operating_margin, asset_turnover
                ) VALUES (
                    :date, :symbol, :pbr, :per, :roe, :debt_to_equity,
                    :operating_margin, :asset_turnover
                )
                ON CONFLICT (time, symbol) DO UPDATE SET
                    pbr              = EXCLUDED.pbr,
                    per              = EXCLUDED.per,
                    roe              = EXCLUDED.roe,
                    debt_to_equity   = EXCLUDED.debt_to_equity,
                    operating_margin = EXCLUDED.operating_margin,
                    asset_turnover   = EXCLUDED.asset_turnover
                """
            ),
            rows,
        )
    return len(rows)


def backfill(
    symbols: List[str],
    start: str,
    end: Optional[str] = None,
) -> dict:
    """compute → save 묶음. 진행 로그 출력."""
    end = end or date.today().isoformat()
    print(f"📥 Loading market_data + fundamental_data ({len(symbols)} symbols, {start} ~ {end})...")
    df = compute_fundamental_factors(symbols, start, end)
    print(
        f"   computed rows: {len(df)} (with at least one factor: {df[FUNDAMENTAL_FACTOR_COLUMNS].notna().any(axis=1).sum()})"
    )
    saved = save_fundamental_factors(df)
    print(f"💾 Saved {saved} rows to fundamental_factors")
    return {"computed": len(df), "saved": saved}
