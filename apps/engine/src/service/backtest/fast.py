"""
Grid search 전용 lightweight 백테스트.

설계 원칙:
  - DataCache가 universe·기간 데이터를 SQL에서 한 번만 로드
  - fast_backtest는 in-memory pandas 연산만 수행 (DB 라운드트립 0)
  - 거래비용/슬리피지는 portfolio_backtest와 동일 함수 재사용 → 절대값 호환

portfolio_backtest와의 차이:
  - 벤치마크 / final_positions / equity 시계열 등 리포팅 데이터 생략 (메트릭만)
  - 진입가는 그날 종가 (실제 매매 시점 모델링은 단순화)
  - 신호 기반 청산(signal_exit_clauses)은 미지원 — grid search는 단일 진입만 다룸

상대적 순위 비교에 충분하며, top 후보를 portfolio_backtest로 다시 검증하는 흐름을 권장.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sqlalchemy import text

from src.core.database import engine
from src.service.factor import FACTOR_COLUMNS
from src.service.backtest.portfolio import (
    _ensure_benchmark_data,
    _get_benchmark,
    _net_entry_price,
    _net_exit_price,
)
from src.service.factor import _resolve_universe


@dataclass
class DataCache:
    """universe + 기간의 factor·close·benchmark 데이터를 한 번만 SQL에서 끌어와 보관."""

    universe: str
    start: str
    end: str
    symbols: List[str]
    # wide format: index=date(Timestamp), columns=symbol
    close_wide: pd.DataFrame
    # long format: ['date', 'symbol', factor_cols...]
    factors_long: pd.DataFrame
    # 벤치마크 (universe별 대표 ETF) — alpha/beta 계산용
    benchmark_symbol: str
    benchmark_label: str
    benchmark_close: pd.Series  # index=date(Timestamp)

    @classmethod
    def load(cls, universe: str, start: str, end: str) -> "DataCache":
        symbols = _resolve_universe(universe)
        if not symbols:
            raise ValueError(f"Universe '{universe}' is empty")

        bench_symbol, bench_label = _get_benchmark(universe)
        _ensure_benchmark_data(bench_symbol)

        all_syms = symbols + [bench_symbol]
        params: Dict[str, Any] = {"symbols": all_syms, "start": start, "end": end}

        cols_sql = ", ".join(FACTOR_COLUMNS)
        # ANY(:symbols::text[]) 으로 plan cache 친화적, CAST 로 chunk pruning 명시 활성.
        q_factors = text(
            f"""
            SELECT time::date AS date, symbol, {cols_sql}
            FROM factors
            WHERE symbol = ANY(:symbols)
              AND time >= CAST(:start AS timestamptz)
              AND time < CAST(:end AS date) + INTERVAL '1 day'
            """
        )
        q_close = text(
            """
            SELECT time::date AS date, symbol, close
            FROM market_data
            WHERE symbol = ANY(:symbols)
              AND time >= CAST(:start AS timestamptz)
              AND time < CAST(:end AS date) + INTERVAL '1 day'
            """
        )
        with engine.connect() as conn:
            factors_df = pd.read_sql(q_factors, conn, params=params)
            close_df = pd.read_sql(q_close, conn, params=params)

        if close_df.empty:
            raise ValueError("No close data in range")

        close_df["date"] = pd.to_datetime(close_df["date"])
        factors_df["date"] = pd.to_datetime(factors_df["date"])
        close_wide = close_df.pivot_table(
            index="date", columns="symbol", values="close", aggfunc="last"
        ).sort_index()

        bench_close = (
            close_wide[bench_symbol]
            if bench_symbol in close_wide.columns
            else pd.Series(dtype=float)
        )
        # 백테스트는 universe 종목만 — 벤치마크 컬럼은 별도 보관
        if bench_symbol in close_wide.columns:
            close_wide = close_wide.drop(columns=[bench_symbol])

        return cls(
            universe=universe,
            start=start,
            end=end,
            symbols=symbols,
            close_wide=close_wide,
            factors_long=factors_df,
            benchmark_symbol=bench_symbol,
            benchmark_label=bench_label,
            benchmark_close=bench_close,
        )

    def slice(self, start: str, end: str) -> "DataCache":
        """캐시된 데이터를 기간만 잘라 새 DataCache 반환 (얕은 슬라이싱)."""
        s = pd.Timestamp(start)
        e = pd.Timestamp(end)
        close = self.close_wide.loc[s:e]
        fac = self.factors_long[(self.factors_long["date"] >= s) & (self.factors_long["date"] <= e)]
        bench = (
            self.benchmark_close.loc[s:e]
            if not self.benchmark_close.empty
            else self.benchmark_close
        )
        return DataCache(
            universe=self.universe,
            start=start,
            end=end,
            symbols=self.symbols,
            close_wide=close,
            factors_long=fac,
            benchmark_symbol=self.benchmark_symbol,
            benchmark_label=self.benchmark_label,
            benchmark_close=bench,
        )


# ---------------------------------------------------------------------------
# clause 평가
# ---------------------------------------------------------------------------
def _apply_clause(df: pd.DataFrame, factor: str, op: str, value: float) -> pd.Series:
    col = df[factor]
    if op == "<":
        return col < value
    if op == "<=":
        return col <= value
    if op == ">":
        return col > value
    if op == ">=":
        return col >= value
    if op == "=":
        return col == value
    if op == "!=":
        return col != value
    raise ValueError(f"Unknown op: {op}")


# ---------------------------------------------------------------------------
# 메트릭 계산 (portfolio_backtest와 동일 의미)
# ---------------------------------------------------------------------------
def _safe_float(v) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    return f if np.isfinite(f) else 0.0


def _benchmark_metrics(equity: pd.Series, benchmark_close: pd.Series) -> Dict[str, float]:
    """벤치마크 대비 alpha / beta / 초과 CAGR 계산. 데이터 부족 시 0."""
    if benchmark_close is None or benchmark_close.empty or len(equity) < 2:
        return {"alpha": 0.0, "beta": 0.0, "excess_cagr": 0.0, "benchmark_cagr": 0.0}

    # 공통 인덱스로 정렬
    bench = benchmark_close.reindex(equity.index).ffill().dropna()
    common = equity.index.intersection(bench.index)
    if len(common) < 2:
        return {"alpha": 0.0, "beta": 0.0, "excess_cagr": 0.0, "benchmark_cagr": 0.0}

    eq = equity.loc[common]
    bk = bench.loc[common]

    # benchmark CAGR
    days = (bk.index[-1] - bk.index[0]).days
    years = max(days / 365.25, 1e-9)
    b_start = _safe_float(bk.iloc[0])
    b_end = _safe_float(bk.iloc[-1])
    if b_start > 0 and b_end > 0:
        bench_cagr = (b_end / b_start) ** (1 / years) - 1
    else:
        bench_cagr = 0.0

    e_start = _safe_float(eq.iloc[0])
    e_end = _safe_float(eq.iloc[-1])
    if e_start > 0 and e_end > 0:
        eq_cagr = (e_end / e_start) ** (1 / years) - 1
    else:
        eq_cagr = 0.0

    # 일간 수익률
    er = eq.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    br = bk.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    common_r = er.index.intersection(br.index)
    if len(common_r) < 5:
        return {
            "alpha": 0.0,
            "beta": 0.0,
            "excess_cagr": _safe_float(eq_cagr - bench_cagr),
            "benchmark_cagr": _safe_float(bench_cagr),
        }
    er2 = er.loc[common_r]
    br2 = br.loc[common_r]

    var_b = _safe_float(br2.var())
    if var_b > 0:
        cov = _safe_float(((er2 - er2.mean()) * (br2 - br2.mean())).mean())
        beta = cov / var_b
    else:
        beta = 0.0

    # alpha: CAPM 잔차의 연간화 평균. r_f 무시 (rf=0)
    daily_alpha = _safe_float(er2.mean()) - beta * _safe_float(br2.mean())
    alpha = daily_alpha * 252

    return {
        "alpha": _safe_float(alpha),
        "beta": _safe_float(beta),
        "excess_cagr": _safe_float(eq_cagr - bench_cagr),
        "benchmark_cagr": _safe_float(bench_cagr),
    }


def _compute_metrics(
    equity: pd.Series,
    trades: List[Dict[str, Any]],
    benchmark_close: Optional[pd.Series] = None,
) -> Dict[str, Any]:
    if len(equity) < 2:
        return {
            "cagr": 0.0,
            "mdd": 0.0,
            "sharpe": 0.0,
            "num_trades": 0,
            "win_rate": 0.0,
            "avg_hold_days": 0.0,
            "alpha": 0.0,
            "beta": 0.0,
            "excess_cagr": 0.0,
            "benchmark_cagr": 0.0,
        }

    start_v = _safe_float(equity.iloc[0])
    end_v = _safe_float(equity.iloc[-1])
    days = (equity.index[-1] - equity.index[0]).days
    years = max(days / 365.25, 1e-9)

    if start_v > 0 and end_v > 0:
        cagr = (end_v / start_v) ** (1 / years) - 1
    elif end_v <= 0:
        cagr = -1.0
    else:
        cagr = 0.0

    rolling_max = equity.cummax()
    drawdown = (equity / rolling_max - 1).replace([np.inf, -np.inf], np.nan).dropna()
    mdd = _safe_float(drawdown.min()) if len(drawdown) > 0 else 0.0

    rets = equity.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    std = _safe_float(rets.std())
    mean = _safe_float(rets.mean())
    sharpe = mean / std * np.sqrt(252) if std > 0 else 0.0

    n = len(trades)
    if n == 0:
        win_rate = 0.0
        avg_hold = 0.0
    else:
        wins = sum(1 for t in trades if t["return_pct"] > 0)
        win_rate = wins / n
        avg_hold = sum(t["hold_days"] for t in trades) / n

    bench = (
        _benchmark_metrics(equity, benchmark_close)
        if benchmark_close is not None
        else {"alpha": 0.0, "beta": 0.0, "excess_cagr": 0.0, "benchmark_cagr": 0.0}
    )

    return {
        "cagr": _safe_float(cagr),
        "mdd": _safe_float(mdd),
        "sharpe": _safe_float(sharpe),
        "num_trades": n,
        "win_rate": _safe_float(win_rate),
        "avg_hold_days": _safe_float(avg_hold),
        **bench,
    }


# ---------------------------------------------------------------------------
# 메인 백테스트
# ---------------------------------------------------------------------------
def fast_backtest(
    cache: DataCache,
    clauses: List[Dict[str, Any]],
    max_positions: int = 10,
    exit_policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    AND 결합된 clause 들을 만족하는 종목을 매수, exit_policy로 청산하는 단일 패스 백테스트.

    포지션 사이징: 진입 시점에 (총자산 / max_positions) 만큼 균등 배분.
    """
    if cache.close_wide.empty:
        return _compute_metrics(pd.Series(dtype=float), [])

    # 1) clause 마스크 — factor row에 boolean 열 부여
    fac = cache.factors_long
    mask = pd.Series(True, index=fac.index)
    for c in clauses:
        mask &= _apply_clause(fac, c["factor"], c["op"], c["value"])
    passing = fac.loc[mask, ["date", "symbol"]]
    # 일자별 통과 종목 set
    passing_by_date: Dict[pd.Timestamp, set] = (
        passing.groupby("date")["symbol"].apply(set).to_dict()
    )

    # 2) exit policy 파싱
    sl = exit_policy.get("stop_loss_pct") if exit_policy else None
    tp = exit_policy.get("take_profit_pct") if exit_policy else None
    te = exit_policy.get("time_exit_days") if exit_policy else None
    ts = exit_policy.get("trailing_stop_pct") if exit_policy else None

    closes = cache.close_wide
    dates = list(closes.index)

    cash = 1.0  # 초기 자본 (정규화)
    positions: Dict[str, Dict[str, Any]] = {}
    trades: List[Dict[str, Any]] = []
    equity_records: List[tuple] = []

    for d in dates:
        # 가격 row (NaN 다수)
        prices = closes.loc[d]

        # 2-1) 청산 평가
        to_exit: List[tuple] = []
        for sym, p in positions.items():
            if sym not in prices.index:
                continue
            px = prices[sym]
            if pd.isna(px):
                continue
            p["days_held"] += 1
            if px > p["peak_price"]:
                p["peak_price"] = px

            ret_pct = (px / p["entry_price"] - 1) * 100
            reason: Optional[str] = None
            if sl is not None and ret_pct <= sl:
                reason = "stop_loss"
            elif tp is not None and ret_pct >= tp:
                reason = "take_profit"
            elif te is not None and p["days_held"] >= te:
                reason = "time_exit"
            elif ts is not None:
                trail = (px / p["peak_price"] - 1) * 100
                if trail <= ts:
                    reason = "trailing_stop"

            if reason is not None:
                to_exit.append((sym, px, reason))

        for sym, px, reason in to_exit:
            p = positions.pop(sym)
            net_exit = _net_exit_price(px, sym)
            cash += p["shares"] * net_exit
            entry_net = p["entry_net"]
            ret_real = net_exit / entry_net - 1
            trades.append(
                {
                    "symbol": sym,
                    "entry_date": p["entry_date"],
                    "exit_date": d,
                    "entry_price": p["entry_price"],
                    "exit_price": px,
                    "return_pct": ret_real,
                    "hold_days": p["days_held"],
                    "exit_reason": reason,
                }
            )

        # 2-2) 진입 후보 (오늘 통과한 종목 - 이미 보유 - 가격 NaN 제외)
        slots = max_positions - len(positions)
        if slots > 0:
            cand_syms = passing_by_date.get(d, set()) - set(positions.keys())
            # 가격 있는 것만, 결정성 위해 정렬
            valid = sorted(s for s in cand_syms if s in prices.index and not pd.isna(prices[s]))
            if valid:
                # 균등 배분: 현재 총자산 / max_positions
                pos_value_now = sum(
                    p["shares"] * prices[s]
                    for s, p in positions.items()
                    if s in prices.index and not pd.isna(prices[s])
                )
                total_eq = cash + pos_value_now
                per_slot = total_eq / max_positions
                for sym in valid[:slots]:
                    if cash < per_slot:
                        break
                    px = prices[sym]
                    entry_net = _net_entry_price(px, sym)
                    shares = per_slot / entry_net
                    positions[sym] = {
                        "entry_date": d,
                        "entry_price": px,
                        "entry_net": entry_net,
                        "peak_price": px,
                        "days_held": 0,
                        "shares": shares,
                    }
                    cash -= shares * entry_net

        # 2-3) 총자산 기록
        eq = cash
        for sym, p in positions.items():
            if sym in prices.index and not pd.isna(prices[sym]):
                eq += p["shares"] * prices[sym]
        equity_records.append((d, eq))

    equity = pd.Series([v for _, v in equity_records], index=[d for d, _ in equity_records])
    return _compute_metrics(equity, trades, benchmark_close=cache.benchmark_close)
