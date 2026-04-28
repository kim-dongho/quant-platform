"""
전략 자동 탐색 (grid search).

흐름:
  1) universe 종목들의 factor 값 분포에서 quantile threshold 후보 추출
  2) (factor × op × threshold) 단일 절 후보 N개 생성
  3) n_clauses=1 → 각 단일 절 그대로
     n_clauses=2 → 다른 factor끼리 AND 조합
  4) 각 조합을 train·test 기간에 백테스트
  5) train·test 모두 양수 Sharpe인 것만 평균 Sharpe 정렬, 상위 N개 반환

⚠️ Multiple-testing 함정: 수백 조합을 한 번에 시험하면 우연히 좋아 보이는 게
   섞이게 됩니다. test 기간에서도 좋아야 의미있고, 그래도 미래는 보장되지 않습니다.
"""
from __future__ import annotations

import itertools
from datetime import date, datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

import pandas as pd
from sqlalchemy import text

from src.core.database import engine
from src.service.backtest.fast import DataCache, fast_backtest
from src.service.factor import _resolve_universe

DEFAULT_FACTORS = [
    "rsi_14",
    "vol_ratio_20d",
    "return_5d",
    "price_vs_sma50",
]
DEFAULT_OPS = ["<", ">"]
DEFAULT_PERCENTILES = [0.1, 0.3, 0.5, 0.7, 0.9]

# 청산 규칙이 없으면 max_positions 차고 나서 거래가 정체돼 num_trades=0이 된다.
# 의미있는 통계가 나오도록 손절·익절·시간청산을 기본으로 주입.
DEFAULT_EXIT_POLICY: Dict[str, Any] = {
    "stop_loss_pct": -8.0,
    "take_profit_pct": 15.0,
    "time_exit_days": 20,
    "trailing_stop_pct": None,
    "signal_exit_clauses": [],
}


def _factor_quantiles(symbols: List[str], factor: str, percentiles: List[float]) -> List[float]:
    """factors 테이블에서 universe 종목들의 factor 값 quantile 후보 반환."""
    if not symbols:
        return []
    placeholders = ", ".join([f":s{i}" for i in range(len(symbols))])
    params = {f"s{i}": s for i, s in enumerate(symbols)}
    query = text(
        f"""
        SELECT {factor} AS v FROM factors
        WHERE symbol IN ({placeholders}) AND {factor} IS NOT NULL
        """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params=params)
    if df.empty:
        return []
    qs = df["v"].quantile(percentiles).tolist()
    out: List[float] = []
    seen = set()
    for q in qs:
        r = round(float(q), 4)
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out


def _split_train_test(
    start_date: Optional[str], end_date: Optional[str], train_ratio: float
) -> tuple[str, str, str, str]:
    """기간을 train/test로 나눠 (train_start, train_end, test_start, test_end) 반환."""
    end = end_date or date.today().isoformat()
    if start_date:
        start = start_date
    else:
        end_dt = datetime.fromisoformat(end).date()
        # 디폴트 10년 — 약세장(2018, 2020, 2022)·강세장 모두 포함해 robust한 룰 발견
        start = (end_dt - timedelta(days=365 * 10)).isoformat()

    start_dt = datetime.fromisoformat(start).date()
    end_dt = datetime.fromisoformat(end).date()
    total_days = (end_dt - start_dt).days
    split_day = start_dt + timedelta(days=int(total_days * train_ratio))
    return start, split_day.isoformat(), split_day.isoformat(), end


def _build_single_clauses(
    symbols: List[str], factors: List[str], ops: List[str], percentiles: List[float]
) -> List[Dict[str, Any]]:
    """factor × op × threshold 단일 절 후보 모두 생성."""
    out: List[Dict[str, Any]] = []
    for f in factors:
        thresholds = _factor_quantiles(symbols, f, percentiles)
        if not thresholds:
            print(f"  ⚠️ No data for factor '{f}', skipping")
            continue
        for op in ops:
            for t in thresholds:
                out.append({"factor": f, "op": op, "value": t})
    return out


def _format_clauses(clauses: List[Dict[str, Any]]) -> str:
    return " & ".join(f"{c['factor']} {c['op']} {c['value']:.3f}" for c in clauses)


def discover(
    universe: str = "krx350",
    factors: Optional[List[str]] = None,
    ops: Optional[List[str]] = None,
    percentiles: Optional[List[float]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    train_ratio: float = 0.7,
    max_positions: int = 10,
    exit_policy: Optional[Dict[str, Any]] = None,
    n_clauses: int = 1,
    top_n: int = 5,
    progress_cb: Optional[Callable[[int, int, str], None]] = None,
) -> Dict[str, Any]:
    """
    Grid search.

    n_clauses:
      1 → 각 단일 절 평가 (예: rsi_14 < 30)
      2 → 다른 factor끼리 AND 조합 (예: rsi_14 < 30 AND vol_ratio_20d > 1.5)

    반환:
      {
        "params": { universe, train_period, test_period, n_clauses, ... },
        "evaluated": int,
        "skipped": int,
        "top": List[ResultRow],   # 상위 top_n개
        "all": List[ResultRow],   # 양수 Sharpe인 모든 조합
      }
    각 row는 'clauses' 필드(List[Dict])로 룰을 보관 — 1절·2절 모두 동일 구조.
    """
    if n_clauses not in (1, 2):
        raise ValueError(f"n_clauses must be 1 or 2, got {n_clauses}")

    factors = factors or DEFAULT_FACTORS
    ops = ops or DEFAULT_OPS
    percentiles = percentiles or DEFAULT_PERCENTILES
    if exit_policy is None:
        exit_policy = DEFAULT_EXIT_POLICY

    train_start, train_end, test_start, test_end = _split_train_test(
        start_date, end_date, train_ratio
    )

    symbols = _resolve_universe(universe)
    if not symbols:
        raise ValueError(f"Universe '{universe}' is empty")

    # 0) 데이터를 한 번만 SQL에서 로드 → 슬라이싱으로 train/test 재사용
    full_cache = DataCache.load(universe, train_start, test_end)
    train_cache = full_cache.slice(train_start, train_end)
    test_cache = full_cache.slice(test_start, test_end)

    # 1) 단일 절 후보
    singles = _build_single_clauses(symbols, factors, ops, percentiles)

    # 2) n_clauses에 따른 평가 대상 조합
    combos: List[List[Dict[str, Any]]]
    if n_clauses == 1:
        combos = [[s] for s in singles]
    else:  # n_clauses == 2
        combos = []
        for c1, c2 in itertools.combinations(singles, 2):
            # 같은 factor끼리 AND는 의미 없거나 중복 (예: rsi<30 AND rsi<50)
            if c1["factor"] == c2["factor"]:
                continue
            combos.append([c1, c2])

    total = len(combos)
    if total == 0:
        return {
            "params": {
                "universe": universe,
                "train_period": [train_start, train_end],
                "test_period": [test_start, test_end],
                "max_positions": max_positions,
                "n_clauses": n_clauses,
            },
            "evaluated": 0,
            "skipped": 0,
            "top": [],
            "all": [],
        }

    # 3) 각 조합 평가
    results: List[Dict[str, Any]] = []
    skipped = 0
    for i, clauses in enumerate(combos):
        label = _format_clauses(clauses)
        if progress_cb:
            progress_cb(i + 1, total, label)
        try:
            train_m = fast_backtest(
                train_cache, clauses, max_positions=max_positions, exit_policy=exit_policy
            )
            test_m = fast_backtest(
                test_cache, clauses, max_positions=max_positions, exit_policy=exit_policy
            )
        except Exception as e:
            print(f"  ⚠️ {label}: {e}")
            skipped += 1
            continue

        if train_m.get("num_trades", 0) < 3 or test_m.get("num_trades", 0) < 1:
            skipped += 1
            continue

        results.append(
            {
                "clauses": clauses,
                "train_sharpe": train_m.get("sharpe", 0.0),
                "train_cagr": train_m.get("cagr", 0.0),
                "train_mdd": train_m.get("mdd", 0.0),
                "train_trades": train_m.get("num_trades", 0),
                "train_win_rate": train_m.get("win_rate", 0.0),
                "train_alpha": train_m.get("alpha", 0.0),
                "train_beta": train_m.get("beta", 0.0),
                "train_excess_cagr": train_m.get("excess_cagr", 0.0),
                "test_sharpe": test_m.get("sharpe", 0.0),
                "test_cagr": test_m.get("cagr", 0.0),
                "test_mdd": test_m.get("mdd", 0.0),
                "test_trades": test_m.get("num_trades", 0),
                "test_win_rate": test_m.get("win_rate", 0.0),
                "test_alpha": test_m.get("alpha", 0.0),
                "test_beta": test_m.get("beta", 0.0),
                "test_excess_cagr": test_m.get("excess_cagr", 0.0),
            }
        )

    # 4) 정렬 — 항상 top_n개 채워짐
    #    1순위: train·test 모두 alpha 양수 (양호한 룰 우선)
    #    2순위: alpha 평균 (벤치마크 초과수익)
    #    3순위: sharpe 평균 (위험조정 수익)
    def _sort_key(r: Dict[str, Any]) -> tuple:
        both_positive = (
            (1 if r["train_alpha"] > 0 else 0) + (1 if r["test_alpha"] > 0 else 0)
        )
        return (
            both_positive,
            (r["train_alpha"] + r["test_alpha"]) / 2,
            (r["train_sharpe"] + r["test_sharpe"]) / 2,
        )

    results.sort(key=_sort_key, reverse=True)

    return {
        "params": {
            "universe": universe,
            "train_period": [train_start, train_end],
            "test_period": [test_start, test_end],
            "max_positions": max_positions,
            "n_clauses": n_clauses,
            "factors_tried": factors,
            "ops_tried": ops,
            "percentiles_tried": percentiles,
        },
        "evaluated": len(results),
        "skipped": skipped,
        "top": results[:top_n],
        "all": results,
    }


# ─────────────────────────────────────────────────────────────
# Backwards-compatible wrapper (CLI/external callers)
# ─────────────────────────────────────────────────────────────
def discover_single_clause(**kwargs) -> Dict[str, Any]:
    return discover(n_clauses=1, **kwargs)
