"""
Walk-forward analysis CLI.

전체 기간을 rolling window 로 잘라 각 window 마다 discover (grid search) 를 실행.
각 window 의 top-1 룰의 train·test 성과를 누적해 룰의 시간적 일관성 / OOS 안정성 평가.

목적:
  - 단일 백테스트가 우연히 잘 통한 것인지, 시장 환경 바뀌어도 통하는지 구분
  - top 룰이 window 마다 같은지 (안정) vs 매번 다른지 (불안정) 관찰
  - train·test gap 의 평균/분산으로 overfit 정도 가늠

사용 예:
    python -u -m src.scripts.walk_forward                                    # 디폴트 6년 / 24개월 window / 6개월 step
    python -u -m src.scripts.walk_forward --window-months 18 --step-months 3  # 더 촘촘하게
    python -u -m src.scripts.walk_forward --quick                            # smoke test
    python -u -m src.scripts.walk_forward --json-out wf.json
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from dateutil.relativedelta import relativedelta

from src.service.backtest import (
    DEFAULT_FACTORS,
    DEFAULT_OPS,
    DEFAULT_PERCENTILES,
    discover,
)


def _fmt_pct(v: float) -> str:
    return f"{v * 100:>+6.2f}%"


def _format_clauses(clauses: List[Dict[str, Any]]) -> str:
    return " & ".join(f"{c['factor']} {c['op']} {c['value']:.3f}" for c in clauses)


def _generate_windows(
    start: str, end: str, window_months: int, step_months: int
) -> List[Tuple[str, str]]:
    """[start, end] 범위에 들어가는 (window_start, window_end) 쌍을 생성."""
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


def _run_one_window(
    window_idx: int,
    total: int,
    win_start: str,
    win_end: str,
    *,
    universe: str,
    factors: List[str],
    ops: List[str],
    percentiles: List[float],
    train_ratio: float,
    max_positions: int,
    n_clauses: int,
) -> Optional[Dict[str, Any]]:
    """단일 window 에 discover 실행 후 train 메트릭만으로 best 룰 선택, OOS test 성과 반환.

    discover 의 기본 정렬은 train+test 평균 알파인데, 그걸 그대로 쓰면 test 기간이
    룰 선택에 새어들어가 walk-forward 의 OOS 가 깨진다. 여기서는 result["all"] 을
    train_sharpe 기준으로 재정렬해 진짜 OOS 평가를 보장.
    """
    print(f"\n▶ Window {window_idx}/{total}: {win_start} ~ {win_end}")
    started = time.time()
    result = discover(
        universe=universe,
        factors=factors,
        ops=ops,
        percentiles=percentiles,
        start_date=win_start,
        end_date=win_end,
        train_ratio=train_ratio,
        max_positions=max_positions,
        n_clauses=n_clauses,
        top_n=1,  # 어차피 all 에서 재정렬해서 안 씀
    )
    elapsed = time.time() - started
    p = result["params"]
    print(
        f"  train {p['train_period'][0]}~{p['train_period'][1]} / "
        f"test {p['test_period'][0]}~{p['test_period'][1]} · "
        f"evaluated={result['evaluated']} · {elapsed:.0f}s"
    )

    all_rows = result.get("all", [])
    if not all_rows:
        print("  ⚠️ 평가 가능한 룰 없음 (모든 조합 거래 부족)")
        return None
    # train 메트릭만으로 정렬 → 진짜 OOS 평가
    all_rows_sorted = sorted(all_rows, key=lambda r: r["train_sharpe"], reverse=True)
    r = all_rows_sorted[0]
    rule = _format_clauses(r["clauses"])
    print(
        f"  🏆 {rule}  | "
        f"train CAGR {_fmt_pct(r['train_cagr'])}  test CAGR {_fmt_pct(r['test_cagr'])}  "
        f"gap {_fmt_pct(r['train_cagr'] - r['test_cagr'])}"
    )
    return {
        "window_idx": window_idx,
        "window_start": win_start,
        "window_end": win_end,
        "train_period": p["train_period"],
        "test_period": p["test_period"],
        "rule": rule,
        "clauses": r["clauses"],
        "train_cagr": r["train_cagr"],
        "test_cagr": r["test_cagr"],
        "train_sharpe": r["train_sharpe"],
        "test_sharpe": r["test_sharpe"],
        "train_mdd": r["train_mdd"],
        "test_mdd": r["test_mdd"],
        "train_trades": r["train_trades"],
        "test_trades": r["test_trades"],
        "train_alpha": r["train_alpha"],
        "test_alpha": r["test_alpha"],
    }


def _print_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """누적 결과 표 + 집계 통계."""
    if not rows:
        print("\n(결과 없음)")
        return {}

    print("\n" + "=" * 110)
    print("📊 Walk-forward 결과 요약")
    print("=" * 110)
    header = (
        f"{'#':>2}  {'Train':<23}  {'Test':<23}  "
        f"{'Rule':<35}  {'TrCAGR':>8}  {'TeCAGR':>8}  {'Gap':>8}"
    )
    print(header)
    print("-" * len(header))
    for r in rows:
        rule = r["rule"][:35]
        gap = r["train_cagr"] - r["test_cagr"]
        tr = f"{r['train_period'][0]}~{r['train_period'][1]}"
        te = f"{r['test_period'][0]}~{r['test_period'][1]}"
        print(
            f"{r['window_idx']:>2}  {tr:<23}  {te:<23}  "
            f"{rule:<35}  {_fmt_pct(r['train_cagr'])}  {_fmt_pct(r['test_cagr'])}  {_fmt_pct(gap)}"
        )

    # 집계
    n = len(rows)
    test_cagrs = [r["test_cagr"] for r in rows]
    train_cagrs = [r["train_cagr"] for r in rows]
    gaps = [t - e for t, e in zip(train_cagrs, test_cagrs)]
    mean_test = sum(test_cagrs) / n
    mean_train = sum(train_cagrs) / n
    mean_gap = sum(gaps) / n
    var_test = sum((c - mean_test) ** 2 for c in test_cagrs) / n
    std_test = var_test**0.5
    neg_count = sum(1 for c in test_cagrs if c < 0)
    rule_counter = Counter(r["rule"] for r in rows)
    top_rule, top_freq = rule_counter.most_common(1)[0]

    print("\n" + "-" * 110)
    print(f"  Mean Train CAGR : {_fmt_pct(mean_train)}")
    print(f"  Mean Test CAGR  : {_fmt_pct(mean_test)}  (std ±{std_test * 100:.2f}%p)")
    print(f"  Mean Train-Test Gap: {_fmt_pct(mean_gap)}")
    print(f"  Negative test windows: {neg_count}/{n}")
    print(f"  Top rule: {top_rule}  ({top_freq}/{n} windows)")
    print(f"  Unique rules: {len(rule_counter)}/{n}")
    print("=" * 110)

    return {
        "n_windows": n,
        "mean_train_cagr": mean_train,
        "mean_test_cagr": mean_test,
        "std_test_cagr": std_test,
        "mean_gap": mean_gap,
        "negative_test_windows": neg_count,
        "top_rule": top_rule,
        "top_rule_freq": top_freq,
        "unique_rules": len(rule_counter),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Walk-forward analysis (rolling-window grid search)"
    )
    parser.add_argument("--universe", default="krx350")
    parser.add_argument("--start", help="전체 기간 시작 YYYY-MM-DD (기본: end - 6년)")
    parser.add_argument("--end", help="전체 기간 끝 YYYY-MM-DD (기본: 오늘)")
    parser.add_argument(
        "--window-months", type=int, default=24, help="각 window 길이 (개월, 기본 24)"
    )
    parser.add_argument(
        "--step-months", type=int, default=6, help="window 슬라이드 step (개월, 기본 6)"
    )
    parser.add_argument("--train-ratio", type=float, default=0.7, help="window 내 train 비율")
    parser.add_argument("--n-clauses", type=int, choices=[1, 2], default=1)
    parser.add_argument("--max-positions", type=int, default=10)
    parser.add_argument("--factors", nargs="+", default=None)
    parser.add_argument("--ops", nargs="+", default=None)
    parser.add_argument(
        "--quick", action="store_true", help="smoke test: factor 1개·percentile 2개만"
    )
    parser.add_argument("--json-out", help="결과를 JSON 파일로 저장")
    args = parser.parse_args()

    end = args.end or date.today().isoformat()
    if args.start:
        start = args.start
    else:
        start = (datetime.fromisoformat(end).date() - relativedelta(years=6)).isoformat()

    factors = args.factors or DEFAULT_FACTORS
    ops = args.ops or DEFAULT_OPS
    percentiles = DEFAULT_PERCENTILES

    if args.quick:
        factors = factors[:1]
        percentiles = [0.3, 0.7]
        print(f"⚡ Quick mode: factor={factors}, percentiles={percentiles}")

    windows = _generate_windows(start, end, args.window_months, args.step_months)
    if not windows:
        print(f"❌ 윈도우 생성 실패 — start={start}, end={end}, window={args.window_months}m")
        sys.exit(1)

    print(f"🔁 Walk-forward on universe={args.universe}")
    print(f"   범위: {start} ~ {end}")
    print(
        f"   window={args.window_months}m, step={args.step_months}m, train_ratio={args.train_ratio}"
    )
    print(f"   n_clauses={args.n_clauses}, factors={factors}")
    print(f"   총 {len(windows)}개 윈도우 — 각 window 당 수 분 소요\n")

    started = time.time()
    rows: List[Dict[str, Any]] = []
    for i, (ws, we) in enumerate(windows, 1):
        row = _run_one_window(
            i,
            len(windows),
            ws,
            we,
            universe=args.universe,
            factors=factors,
            ops=ops,
            percentiles=percentiles,
            train_ratio=args.train_ratio,
            max_positions=args.max_positions,
            n_clauses=args.n_clauses,
        )
        if row is not None:
            rows.append(row)

    elapsed = time.time() - started
    print(f"\n✅ Done in {elapsed:.0f}s")

    summary = _print_summary(rows)

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(
                {
                    "params": {
                        "universe": args.universe,
                        "start": start,
                        "end": end,
                        "window_months": args.window_months,
                        "step_months": args.step_months,
                        "train_ratio": args.train_ratio,
                        "n_clauses": args.n_clauses,
                        "factors": factors,
                        "ops": ops,
                    },
                    "windows": rows,
                    "summary": summary,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        print(f"💾 Saved to {args.json_out}")


if __name__ == "__main__":
    main()
