"""
전략 자동 탐색 (grid search + walk-forward 검증).

흐름 (discover):
  1) universe 종목들의 factor 값 분포에서 quantile threshold 후보 추출
  2) (factor × op × threshold) 단일 절 후보 N개 생성
  3) n_clauses=1 → 각 단일 절 그대로
     n_clauses=2 → 다른 factor끼리 AND 조합
  4) 각 조합을 train·test 기간에 백테스트
  5) train·test 모두 양수 Sharpe인 것만 평균 Sharpe 정렬, 상위 N개 반환

흐름 (discover_with_walkforward — 권장):
  1) discover()로 후보 top_n_candidates개 빠르게 축소
  2) 후보 룰만 rolling window walk-forward 검증
  3) 윈도우별 OOS calmar ratio 평균 + 안정성(표준편차 패널티)으로 최종 랭킹

⚠️ Multiple-testing 함정: 수백 조합을 한 번에 시험하면 우연히 좋아 보이는 게
   섞이게 됩니다. walk-forward 검증을 거쳐야 robust한 룰을 선별할 수 있습니다.
"""

from __future__ import annotations

import itertools
import statistics
from datetime import date, datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple

import pandas as pd

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


def _factor_quantiles(
    factors_long: pd.DataFrame, factor: str, percentiles: List[float]
) -> List[float]:
    """이미 캐시된 factors_long DataFrame 에서 quantile 후보 추출.

    기존엔 factor 별 SQL 한 번씩 + 시간 범위 제한 없이 전체 history (수십만 row)
    를 가져왔음 — discover 시작 직후 수 초 ~ 수십 초 지연의 주범. SnapshotCache
    가 이미 train+test 기간 데이터를 들고 있으니 그걸로 계산.
    """
    if factor not in factors_long.columns:
        return []
    s = factors_long[factor].dropna()
    if s.empty:
        return []
    qs = s.quantile(percentiles).tolist()
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
    factors_long: pd.DataFrame, factors: List[str], ops: List[str], percentiles: List[float]
) -> List[Dict[str, Any]]:
    """factor × op × threshold 단일 절 후보 모두 생성 (캐시된 factors_long 기반)."""
    out: List[Dict[str, Any]] = []
    for f in factors:
        thresholds = _factor_quantiles(factors_long, f, percentiles)
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
    should_cancel: Optional[Callable[[], bool]] = None,
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

    # 1) 단일 절 후보 — 캐시된 factors_long 으로 quantile 계산 (DB 추가 호출 없음)
    singles = _build_single_clauses(full_cache.factors_long, factors, ops, percentiles)

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
    cancelled = False
    for i, clauses in enumerate(combos):
        if should_cancel and should_cancel():
            cancelled = True
            break
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
        both_positive = (1 if r["train_alpha"] > 0 else 0) + (1 if r["test_alpha"] > 0 else 0)
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
        "cancelled": cancelled,
        "top": results[:top_n],
        "all": results,
    }


# ─────────────────────────────────────────────────────────────
# Backwards-compatible wrapper (CLI/external callers)
# ─────────────────────────────────────────────────────────────
def discover_single_clause(**kwargs) -> Dict[str, Any]:
    return discover(n_clauses=1, **kwargs)


# ─────────────────────────────────────────────────────────────
# Walk-forward 검증 통합 discover
# ─────────────────────────────────────────────────────────────
def _generate_windows(
    start: str, end: str, window_months: int, step_months: int
) -> List[Tuple[str, str]]:
    """[start, end] 범위에 들어가는 (window_start, window_end) 쌍을 생성."""
    from dateutil.relativedelta import relativedelta

    s = datetime.fromisoformat(start).date()
    e = datetime.fromisoformat(end).date()
    out: List[Tuple[str, str]] = []
    cur = s
    while True:
        w_end = cur + relativedelta(months=window_months)
        if w_end > e:
            break
        out.append((cur.isoformat(), w_end.isoformat()))
        cur = cur + relativedelta(months=step_months)
    return out


def _walkforward_score(calmar_values: List[float]) -> float:
    """Walk-forward 최종 점수: 평균 calmar - 0.5 × 표준편차.

    평균이 높되 윈도우간 편차가 큰 (불안정한) 룰에 패널티.
    """
    if not calmar_values:
        return -999.0
    mean = statistics.mean(calmar_values)
    std = statistics.stdev(calmar_values) if len(calmar_values) > 1 else 0.0
    return mean - 0.5 * std


def discover_with_walkforward(
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
    top_n_candidates: int = 30,
    window_months: int = 24,
    step_months: int = 6,
    progress_cb: Optional[Callable[[int, int, str], None]] = None,
    should_cancel: Optional[Callable[[], bool]] = None,
) -> Dict[str, Any]:
    """2단계 discover: grid search 후보 축소 → walk-forward 검증.

    1단계: discover()로 top_n_candidates개 후보 빠르게 추출
    2단계: 후보 룰만 rolling window로 OOS 검증, calmar ratio 기반 최종 랭킹

    반환 형식은 discover()와 동일 + walk-forward 메타데이터 추가.
    """
    if exit_policy is None:
        exit_policy = DEFAULT_EXIT_POLICY

    # ── 1단계: 기존 discover로 후보 축소 ──
    print("🔍 [1/2] Grid search로 후보 룰 축소 중...")
    stage1 = discover(
        universe=universe,
        factors=factors,
        ops=ops,
        percentiles=percentiles,
        start_date=start_date,
        end_date=end_date,
        train_ratio=train_ratio,
        max_positions=max_positions,
        exit_policy=exit_policy,
        n_clauses=n_clauses,
        top_n=top_n_candidates,
        progress_cb=progress_cb,
        should_cancel=should_cancel,
    )

    if stage1.get("cancelled"):
        return stage1

    candidates = stage1["top"]
    if not candidates:
        print("  ⚠️ 1단계에서 후보 없음 — walk-forward 생략")
        return stage1

    print(f"  → {len(candidates)}개 후보 추출 완료")

    # ── 2단계: walk-forward 검증 ──
    end = end_date or date.today().isoformat()
    if start_date:
        start = start_date
    else:
        end_dt = datetime.fromisoformat(end).date()
        start = (end_dt - timedelta(days=365 * 10)).isoformat()

    windows = _generate_windows(start, end, window_months, step_months)
    if len(windows) < 2:
        print(f"  ⚠️ 윈도우 {len(windows)}개 — walk-forward 불가, 1단계 결과 반환")
        return stage1

    print(f"🔁 [2/2] Walk-forward 검증: {len(candidates)}개 룰 × {len(windows)}개 윈도우")

    symbols = _resolve_universe(universe)
    if not symbols:
        return stage1

    # 전체 기간 데이터 한 번만 로드
    full_cache = DataCache.load(universe, start, end)

    wf_results: List[Dict[str, Any]] = []
    total_evals = len(candidates) * len(windows)
    eval_count = 0

    for ci, cand in enumerate(candidates):
        if should_cancel and should_cancel():
            break

        clauses = cand["clauses"]
        label = _format_clauses(clauses)
        window_metrics: List[Dict[str, float]] = []

        for wi, (ws, we) in enumerate(windows):
            eval_count += 1
            if progress_cb:
                progress_cb(eval_count, total_evals, f"WF {ci+1}/{len(candidates)} w{wi+1}")

            # 윈도우 내 train/test split
            train_start, train_end, test_start, test_end = _split_train_test(
                ws, we, train_ratio
            )

            try:
                train_cache = full_cache.slice(train_start, train_end)
                test_cache = full_cache.slice(test_start, test_end)

                # train으로 룰 적합성 확인 (거래 부족 시 스킵)
                train_m = fast_backtest(
                    train_cache, clauses, max_positions=max_positions, exit_policy=exit_policy
                )
                if train_m.get("num_trades", 0) < 3:
                    continue

                # OOS test 성과 측정
                test_m = fast_backtest(
                    test_cache, clauses, max_positions=max_positions, exit_policy=exit_policy
                )
                if test_m.get("num_trades", 0) < 1:
                    continue

                window_metrics.append({
                    "window": f"{ws}~{we}",
                    "test_calmar": test_m.get("calmar", 0.0),
                    "test_cagr": test_m.get("cagr", 0.0),
                    "test_mdd": test_m.get("mdd", 0.0),
                    "test_sharpe": test_m.get("sharpe", 0.0),
                    "test_alpha": test_m.get("alpha", 0.0),
                    "test_trades": test_m.get("num_trades", 0),
                })
            except Exception:
                continue

        if not window_metrics:
            continue

        calmar_values = [w["test_calmar"] for w in window_metrics]
        wf_score = _walkforward_score(calmar_values)
        mean_calmar = statistics.mean(calmar_values)
        mean_cagr = statistics.mean([w["test_cagr"] for w in window_metrics])
        mean_mdd = statistics.mean([w["test_mdd"] for w in window_metrics])
        mean_sharpe = statistics.mean([w["test_sharpe"] for w in window_metrics])

        wf_results.append({
            **cand,  # 1단계 train/test 메트릭 유지
            "wf_score": round(wf_score, 4),
            "wf_mean_calmar": round(mean_calmar, 4),
            "wf_mean_cagr": round(mean_cagr, 4),
            "wf_mean_mdd": round(mean_mdd, 4),
            "wf_mean_sharpe": round(mean_sharpe, 4),
            "wf_windows_passed": len(window_metrics),
            "wf_windows_total": len(windows),
            "wf_window_details": window_metrics,
        })

    # wf_score 기준 최종 정렬
    wf_results.sort(key=lambda r: r["wf_score"], reverse=True)

    if wf_results:
        best = wf_results[0]
        print(
            f"\n🏆 Best: {_format_clauses(best['clauses'])} "
            f"(wf_score={best['wf_score']:.3f}, "
            f"mean_calmar={best['wf_mean_calmar']:.3f}, "
            f"passed={best['wf_windows_passed']}/{best['wf_windows_total']})"
        )

    return {
        "params": {
            **stage1["params"],
            "walkforward": True,
            "window_months": window_months,
            "step_months": step_months,
            "n_windows": len(windows),
            "top_n_candidates": top_n_candidates,
        },
        "evaluated": stage1["evaluated"],
        "skipped": stage1["skipped"],
        "cancelled": bool(should_cancel and should_cancel()),
        "top": wf_results[:top_n],
        "all": wf_results,
    }
