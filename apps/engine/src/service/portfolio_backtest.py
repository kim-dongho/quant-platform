from datetime import date, datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sqlalchemy import text

from src.core.database import engine
from src.service.factors import FACTOR_COLUMNS
from src.service.screener import (
    ALLOWED_OPS,
    ScreenError,
    _resolve_universe,
    _validate_clauses,
)


BENCHMARK_BY_UNIVERSE: Dict[str, str] = {
    # 미국계: S&P 500 ETF (SPY)
    "watchlist": "SPY",
    "sp500": "SPY",
    "nasdaq100": "SPY",
    "russell1000": "SPY",
    "russell2000": "SPY",
    "russell3000": "SPY",
    # 국내계: KOSPI 200 ETF (KODEX 200) / KOSDAQ 150 ETF (KODEX 코스닥150)
    "kospi200": "069500.KS",
    "kosdaq150": "229200.KQ",
    "krx350": "069500.KS",  # 통합 유니버스는 KOSPI 200 대표로
}


def _get_benchmark(universe: str) -> str:
    """universe에 맞는 벤치마크 심볼 반환. 매핑 없으면 SPY 기본."""
    return BENCHMARK_BY_UNIVERSE.get(universe, "SPY")


def _ensure_benchmark_data(symbol: str) -> bool:
    """벤치마크 데이터가 DB에 있는지 확인하고 없으면 수집."""
    with engine.connect() as conn:
        count = conn.execute(
            text("SELECT COUNT(*) FROM market_data WHERE symbol = :s"),
            {"s": symbol},
        ).scalar()
    if count and int(count) > 0:
        return True
    print(f"📥 Benchmark {symbol} missing — lazy ingesting before backtest...")
    try:
        from src.service.ingest import save_to_db

        save_to_db(symbol)
        return True
    except Exception as e:
        print(f"⚠️ Benchmark ingestion failed: {e}")
        return False


def _load_factors(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    """지정 기간의 팩터를 모든 종목에 대해 한 번에 로드.
    같은 날짜에 여러 timestamp가 있을 수 있어 DISTINCT ON으로 가장 최신 것만 선택.
    """
    placeholders = ", ".join([f":s{i}" for i in range(len(symbols))])
    params: Dict[str, Any] = {"start": start, "end": end}
    for i, s in enumerate(symbols):
        params[f"s{i}"] = s

    query = text(
        f"""
        SELECT date, symbol, {", ".join(FACTOR_COLUMNS)} FROM (
            SELECT DISTINCT ON (time::date, symbol)
                time::date AS date, symbol, {", ".join(FACTOR_COLUMNS)}, time
            FROM factors
            WHERE symbol IN ({placeholders})
              AND time::date BETWEEN :start AND :end
            ORDER BY time::date ASC, symbol ASC, time DESC
        ) t
        ORDER BY date ASC, symbol ASC
        """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params=params)
    return df


def _load_closes(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    """지정 기간의 종가를 (date x symbol) wide로 로드.
    같은 날짜-종목에 여러 timestamp가 있을 수 있어 DISTINCT ON으로 최신만 선택.
    """
    placeholders = ", ".join([f":s{i}" for i in range(len(symbols))])
    params: Dict[str, Any] = {"start": start, "end": end}
    for i, s in enumerate(symbols):
        params[f"s{i}"] = s

    query = text(
        f"""
        SELECT date, symbol, close FROM (
            SELECT DISTINCT ON (time::date, symbol)
                time::date AS date, symbol, close, time
            FROM market_data
            WHERE symbol IN ({placeholders})
              AND time::date BETWEEN :start AND :end
            ORDER BY time::date ASC, symbol ASC, time DESC
        ) t
        ORDER BY date ASC
        """
    )
    with engine.connect() as conn:
        long_df = pd.read_sql(query, conn, params=params)
    if long_df.empty:
        return pd.DataFrame()
    return long_df.pivot(index="date", columns="symbol", values="close")


def _apply_clauses(df: pd.DataFrame, clauses: List[Dict[str, Any]]) -> pd.DataFrame:
    mask = pd.Series(True, index=df.index)
    for c in clauses:
        col = c["factor"]
        op = c["op"]
        val = c["value"]
        s = df[col]
        if op == "<":
            mask &= s < val
        elif op == "<=":
            mask &= s <= val
        elif op == ">":
            mask &= s > val
        elif op == ">=":
            mask &= s >= val
        elif op == "=":
            mask &= s == val
        elif op == "!=":
            mask &= s != val
    return df[mask]


def _compute_metrics(equity: pd.Series) -> Dict[str, float]:
    """기본 지표: CAGR, 최대낙폭(MDD), Sharpe (일간 수익률 기준, rf=0)."""
    if len(equity) < 2:
        return {"cagr": 0.0, "mdd": 0.0, "sharpe": 0.0}

    start_val, end_val = equity.iloc[0], equity.iloc[-1]
    days = (equity.index[-1] - equity.index[0]).days
    years = max(days / 365.25, 1e-9)
    cagr = (end_val / start_val) ** (1 / years) - 1 if start_val > 0 else 0.0

    rolling_max = equity.cummax()
    drawdown = equity / rolling_max - 1
    mdd = float(drawdown.min())

    daily_returns = equity.pct_change().dropna()
    if daily_returns.std() > 0:
        sharpe = float(daily_returns.mean() / daily_returns.std() * np.sqrt(252))
    else:
        sharpe = 0.0

    return {"cagr": float(cagr), "mdd": mdd, "sharpe": sharpe}


def run_portfolio_backtest(
    universe: str,
    clauses: List[Dict[str, Any]],
    max_positions: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    유니버스에 룰을 일간 리밸런싱으로 적용해 equity curve를 산출.
    간이 가정: 일간 동일가중 리밸런싱, 수수료/슬리피지 0, 체결가 = 종가.
    """
    _validate_clauses(clauses)
    symbols = _resolve_universe(universe)
    if not symbols:
        raise ScreenError("Universe is empty")

    # universe에 맞는 벤치마크 (미국=SPY, 국내=KODEX 200/150) 데이터가 없으면 lazy 수집
    benchmark_symbol = _get_benchmark(universe)
    _ensure_benchmark_data(benchmark_symbol)

    # 기본 기간: 최근 3년
    end = end_date or date.today().isoformat()
    if start_date:
        start = start_date
    else:
        start = (datetime.fromisoformat(end).date().replace(year=datetime.fromisoformat(end).year - 3)).isoformat()

    factors_df = _load_factors(symbols, start, end)
    closes = _load_closes(symbols + [benchmark_symbol], start, end)

    if factors_df.empty or closes.empty:
        return {
            "dates": [],
            "equity": [],
            "benchmark": [],
            "metrics": {"cagr": 0.0, "mdd": 0.0, "sharpe": 0.0},
            "final_positions": [],
            "note": "insufficient data — factors 또는 market_data가 비어있습니다. 유니버스 종목의 ingest를 먼저 실행하세요.",
        }

    # 거래일 기준: factors_df의 날짜 + closes 인덱스 교집합
    factor_dates = pd.Index(factors_df["date"].unique()).sort_values()
    trading_days = factor_dates.intersection(closes.index)

    if len(trading_days) < 2:
        return {
            "dates": [],
            "equity": [],
            "benchmark": [],
            "metrics": {"cagr": 0.0, "mdd": 0.0, "sharpe": 0.0},
            "final_positions": [],
            "note": "trading_days < 2",
        }

    # 일별 리밸런싱 루프
    equity = 1.0
    equity_rows = []
    current_holdings: List[str] = []

    for i, day in enumerate(trading_days):
        # 1) 오늘자 팩터 스냅샷으로 선정
        day_factors = factors_df[factors_df["date"] == day].set_index("symbol")
        selected_df = _apply_clauses(day_factors, clauses)
        current_holdings = selected_df.head(max_positions).index.tolist()

        # 2) 내일 수익률로 자산 업데이트
        if i + 1 < len(trading_days):
            next_day = trading_days[i + 1]
            if current_holdings:
                valid = [s for s in current_holdings if s in closes.columns]
                if valid:
                    today_prices = closes.loc[day, valid]
                    next_prices = closes.loc[next_day, valid]
                    returns = (next_prices / today_prices - 1).replace([np.inf, -np.inf], np.nan).dropna()
                    if len(returns) > 0:
                        daily_return = float(returns.mean())  # 동일가중 = 평균
                        equity *= 1 + daily_return

        equity_rows.append({"time": day.isoformat(), "value": float(equity)})

    # 벤치마크: SPY 단순 buy&hold
    bench_rows: List[Dict[str, Any]] = []
    if benchmark_symbol in closes.columns:
        bench_series = closes[benchmark_symbol].reindex(trading_days).ffill()
        base = bench_series.iloc[0]
        if base and base > 0:
            bench_rows = [
                {"time": d.isoformat(), "value": float(v / base)}
                for d, v in bench_series.items()
                if pd.notnull(v)
            ]

    equity_series = pd.Series(
        [r["value"] for r in equity_rows],
        index=pd.to_datetime([r["time"] for r in equity_rows]),
    )
    metrics = _compute_metrics(equity_series)

    return {
        "dates": [r["time"] for r in equity_rows],
        "equity": equity_rows,
        "benchmark": bench_rows,
        "metrics": metrics,
        "final_positions": current_holdings,
        "start_date": start,
        "end_date": end,
    }
