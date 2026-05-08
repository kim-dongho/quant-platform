"""
랭킹 기반 펀더멘털 factor 포트폴리오 백테스트.

기존 grid search (threshold 룰) 와 다른 접근:
  - 룰 X. 점수화 + 랭킹.
  - 매 분기 리밸런싱 시 universe 종목들을 각 factor 별 percentile rank
  - 종합 점수 = factor rank 평균 (NaN 인 factor 는 제외하고 평균)
  - top N% 선택 → 동일가중 매수 → 다음 리밸런싱 까지 보유

look-ahead bias 방지:
  - fundamental_factors 가 이미 backward as-of join 으로 만들어짐
  - 단 보고서 공시 lag (Q1 → 5월 중순) 미반영 — 분기말 시점부터 사용 (TODO)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import connectorx as cx
import numpy as np
import pandas as pd
from dateutil.relativedelta import relativedelta

from src.core.database import CONNECTORX_URL
from src.service.backtest.portfolio import (
    _ensure_benchmark_data,
    _get_benchmark,
)
from src.service.factor import _resolve_universe
from src.service.fundamental.factors import FUNDAMENTAL_FACTOR_COLUMNS

# ---------------------------------------------------------------------------
# Factor 방향 — +1: 높을수록 좋음, -1: 낮을수록 좋음.
# ---------------------------------------------------------------------------
DEFAULT_FACTOR_DIRS: Dict[str, int] = {
    "pbr": -1,  # Value (저평가)
    "per": -1,  # Value
    "roe": +1,  # Quality
    "debt_to_equity": -1,  # Risk (낮은 부채)
    "operating_margin": +1,  # Profitability
    "asset_turnover": +1,  # Efficiency
}

# 거래비용 — portfolio.py KR 기준 동일
_COMMISSION_BUY = 0.00015
_COMMISSION_SELL = 0.00015 + 0.0018  # 매도 + 거래세
_SLIPPAGE = 0.001


# ---------------------------------------------------------------------------
# 데이터 로딩
# ---------------------------------------------------------------------------
def _load_close_wide(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    """market_data daily close → wide DataFrame (date index × symbol columns)."""
    syms_lit = ", ".join("'" + s.replace("'", "''") + "'" for s in symbols)
    sql = f"""
        SELECT time::date AS date, symbol, close
        FROM market_data
        WHERE symbol IN ({syms_lit})
          AND time >= '{start}'::timestamptz
          AND time < ('{end}'::date + INTERVAL '1 day')
    """
    long_df = cx.read_sql(CONNECTORX_URL, sql, return_type="pandas")
    if long_df.empty:
        return pd.DataFrame()
    long_df["date"] = pd.to_datetime(long_df["date"])
    return (
        long_df.pivot_table(index="date", columns="symbol", values="close", aggfunc="last")
        .sort_index()
        .ffill()
    )


def _load_fundamental_factors(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    """fundamental_factors long DataFrame. (date, symbol, pbr, per, ...)."""
    syms_lit = ", ".join("'" + s.replace("'", "''") + "'" for s in symbols)
    cols = ", ".join(FUNDAMENTAL_FACTOR_COLUMNS)
    sql = f"""
        SELECT time AS date, symbol, {cols}
        FROM fundamental_factors
        WHERE symbol IN ({syms_lit})
          AND time >= '{start}'::date
          AND time <= '{end}'::date
    """
    df = cx.read_sql(CONNECTORX_URL, sql, return_type="pandas")
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"])
    # connectorx nullable 타입 → numpy float64 일관화
    for c in FUNDAMENTAL_FACTOR_COLUMNS:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype("float64")
    return df.sort_values(["date", "symbol"])


# ---------------------------------------------------------------------------
# 점수화
# ---------------------------------------------------------------------------
def compute_composite_scores(factors_df: pd.DataFrame, factor_dirs: Dict[str, int]) -> pd.Series:
    """주어진 (한 날짜) DataFrame 에 대해 종합 점수 (높을수록 좋음).

    각 factor 별 percentile rank (0~1, 좋은 값일수록 1 에 가까움) → 평균.
    NaN 인 factor 는 평균 계산에서 빠짐.

    rank pct=True + ascending 매핑:
      - direction +1 (높을수록 좋음) → ascending=True  → 큰 값 = 높은 rank ✓
      - direction -1 (낮을수록 좋음) → ascending=False → 작은 값 = 높은 rank ✓
    """
    if factors_df.empty:
        return pd.Series(dtype="float64")
    rank_sum = pd.Series(0.0, index=factors_df.index)
    rank_count = pd.Series(0, index=factors_df.index)
    for col, direction in factor_dirs.items():
        if col not in factors_df.columns:
            continue
        ranked = factors_df[col].rank(pct=True, ascending=(direction > 0), na_option="keep")
        rank_sum = rank_sum.add(ranked.fillna(0), fill_value=0)
        rank_count = rank_count + ranked.notna().astype(int)
    return rank_sum / rank_count.where(rank_count > 0, np.nan)


# ---------------------------------------------------------------------------
# 리밸런싱 일자 생성
# ---------------------------------------------------------------------------
def _generate_rebalance_dates(trading_days: List[pd.Timestamp], months: int) -> List[pd.Timestamp]:
    """trading_days 안에서 N개월 간격의 첫 거래일들."""
    if not trading_days:
        return []
    out = [trading_days[0]]
    next_target = trading_days[0] + relativedelta(months=months)
    for d in trading_days[1:]:
        if d >= next_target:
            out.append(d)
            next_target = d + relativedelta(months=months)
    return out


# ---------------------------------------------------------------------------
# 메트릭
# ---------------------------------------------------------------------------
def _safe_float(v) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    return f if np.isfinite(f) else 0.0


def _compute_metrics(equity: pd.Series, num_trades: int) -> Dict[str, float]:
    if len(equity) < 2:
        return {"cagr": 0.0, "mdd": 0.0, "sharpe": 0.0, "num_trades": num_trades}
    start_v, end_v = float(equity.iloc[0]), float(equity.iloc[-1])
    days = (equity.index[-1] - equity.index[0]).days
    years = max(days / 365.25, 1e-9)
    cagr = (
        (end_v / start_v) ** (1 / years) - 1
        if (start_v > 0 and end_v > 0)
        else (-1.0 if end_v <= 0 else 0.0)
    )
    rolling_max = equity.cummax()
    drawdown = (equity / rolling_max - 1).replace([np.inf, -np.inf], np.nan).dropna()
    mdd = _safe_float(drawdown.min()) if len(drawdown) > 0 else 0.0
    rets = equity.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    std = _safe_float(rets.std())
    mean = _safe_float(rets.mean())
    sharpe = mean / std * np.sqrt(252) if std > 0 else 0.0
    return {
        "cagr": _safe_float(cagr),
        "mdd": _safe_float(mdd),
        "sharpe": _safe_float(sharpe),
        "num_trades": num_trades,
    }


# ---------------------------------------------------------------------------
# 메인 백테스트
# ---------------------------------------------------------------------------
def factor_portfolio_backtest(
    universe: str,
    start: str,
    end: str,
    factor_dirs: Optional[Dict[str, int]] = None,
    top_pct: float = 0.20,
    rebalance_months: int = 3,
    min_stocks: int = 5,
) -> Dict[str, Any]:
    """팩터 포트폴리오 백테스트.

    매 리밸런싱:
      1) 그날 시점의 fundamental_factors 로 종합 점수 계산
      2) 점수 top N% (top_pct) 종목 동일가중 매수
      3) 다음 리밸런싱까지 보유

    리밸런싱 사이 일자에는 mark-to-market 만 (보유 그대로).
    """
    factor_dirs = factor_dirs or DEFAULT_FACTOR_DIRS
    symbols = _resolve_universe(universe)
    if not symbols:
        raise ValueError(f"universe '{universe}' 비어있음")

    bench_symbol, bench_label = _get_benchmark(universe)
    _ensure_benchmark_data(bench_symbol)

    closes = _load_close_wide(symbols + [bench_symbol], start, end)
    if closes.empty:
        return {"metrics": {}, "equity": [], "trades": [], "note": "no market data"}
    factors = _load_fundamental_factors(symbols, start, end)
    if factors.empty:
        return {"metrics": {}, "equity": [], "trades": [], "note": "no fundamental factors"}

    trading_days = list(closes.index)
    rebal_dates = set(_generate_rebalance_dates(trading_days, rebalance_months))
    factors_by_date: Dict[pd.Timestamp, pd.DataFrame] = {
        d: g.set_index("symbol") for d, g in factors.groupby("date")
    }

    # 백테스트 상태
    cash = 1.0
    holdings: Dict[str, float] = {}
    equity_rows: List[Dict[str, Any]] = []
    trade_log: List[Dict[str, Any]] = []

    for d in trading_days:
        prices = closes.loc[d]

        # 1) 리밸런싱
        if d in rebal_dates:
            # 가용 factor 스냅샷
            ff_today = factors_by_date.get(d)
            if ff_today is not None and not ff_today.empty:
                scores = compute_composite_scores(ff_today, factor_dirs).dropna()
                if len(scores) >= min_stocks:
                    n_select = max(min_stocks, int(len(scores) * top_pct))
                    selected = scores.nlargest(n_select).index.tolist()

                    # 청산 — net price 로
                    for sym, qty in list(holdings.items()):
                        if sym in prices.index and pd.notna(prices[sym]):
                            net_px = float(prices[sym]) * (1 - _SLIPPAGE) * (1 - _COMMISSION_SELL)
                            cash += qty * net_px
                            trade_log.append(
                                {
                                    "date": d.date().isoformat(),
                                    "symbol": sym,
                                    "side": "sell",
                                    "price": float(prices[sym]),
                                    "qty": qty,
                                }
                            )
                    holdings = {}

                    # 매수 — 동일가중
                    valid = [
                        s
                        for s in selected
                        if s in prices.index and pd.notna(prices[s]) and prices[s] > 0
                    ]
                    if valid:
                        per_slot = cash / len(valid)
                        for sym in valid:
                            net_px = float(prices[sym]) * (1 + _SLIPPAGE) * (1 + _COMMISSION_BUY)
                            qty = per_slot / net_px
                            holdings[sym] = qty
                            cash -= qty * net_px
                            trade_log.append(
                                {
                                    "date": d.date().isoformat(),
                                    "symbol": sym,
                                    "side": "buy",
                                    "price": float(prices[sym]),
                                    "qty": qty,
                                }
                            )

        # 2) 일별 mark-to-market 평가
        position_value = 0.0
        for sym, qty in holdings.items():
            if sym in prices.index and pd.notna(prices[sym]):
                position_value += qty * float(prices[sym])
        equity = cash + position_value
        equity_rows.append({"time": d.date().isoformat(), "value": float(equity)})

    equity_series = pd.Series(
        [r["value"] for r in equity_rows],
        index=pd.to_datetime([r["time"] for r in equity_rows]),
    )
    metrics = _compute_metrics(equity_series, len(trade_log))

    # 벤치마크
    bench_rows: List[Dict[str, Any]] = []
    if bench_symbol in closes.columns:
        bench = closes[bench_symbol].reindex(trading_days).ffill()
        base = bench.iloc[0]
        if base and base > 0:
            bench_rows = [
                {"time": d.date().isoformat(), "value": float(v / base)}
                for d, v in bench.items()
                if pd.notna(v)
            ]

    return {
        "universe": universe,
        "start_date": start,
        "end_date": end,
        "factor_dirs": factor_dirs,
        "top_pct": top_pct,
        "rebalance_months": rebalance_months,
        "metrics": metrics,
        "dates": [r["time"] for r in equity_rows],
        "equity": equity_rows,
        "benchmark": bench_rows,
        "benchmark_symbol": bench_symbol,
        "benchmark_label": bench_label,
        "trades": trade_log,
        "rebal_dates": sorted([d.date().isoformat() for d in rebal_dates]),
    }
