"""
랭킹 기반 펀더멘털 factor 포트폴리오 백테스트 CLI.

두 모드:
  1) 단일 백테스트 (--start ~ --end 1구간)
  2) walk-forward 비교 (--walkforward + --window-months / --step-months)

사용 예:
    # 1구간
    python -u -m src.scripts.factor_portfolio_backtest --universe kospi200 \
        --start 2020-01-01 --end 2026-05-08

    # walk-forward (기존 grid search 와 같은 framework)
    python -u -m src.scripts.factor_portfolio_backtest --universe kospi200 \
        --start 2020-01-01 --end 2026-05-08 --walkforward \
        --window-months 24 --step-months 6
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime
from typing import Any, Dict, List, Tuple

from dateutil.relativedelta import relativedelta

from src.service.backtest import factor_portfolio_backtest


def _fmt_pct(v: float) -> str:
    return f"{v * 100:>+7.2f}%"


def _generate_windows(
    start: str, end: str, window_months: int, step_months: int
) -> List[Tuple[str, str]]:
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


def _print_metrics_row(label: str, m: Dict[str, float]):
    print(
        f"  {label:30s} | CAGR {_fmt_pct(m.get('cagr', 0))} | "
        f"MDD {_fmt_pct(m.get('mdd', 0))} | "
        f"Sharpe {m.get('sharpe', 0):>5.2f} | "
        f"Trades {m.get('num_trades', 0):>4d}"
    )


def main():
    parser = argparse.ArgumentParser(description="Factor Portfolio Backtest")
    parser.add_argument("--universe", default="kospi200")
    parser.add_argument("--start", default="2020-01-01")
    parser.add_argument("--end", default=None)
    parser.add_argument("--top-pct", type=float, default=0.20, help="top N%% (기본 20%)")
    parser.add_argument(
        "--rebalance-months", type=int, default=3, help="리밸런싱 주기 (기본 3개월)"
    )
    parser.add_argument("--min-stocks", type=int, default=5)
    parser.add_argument("--walkforward", action="store_true", help="walk-forward 모드")
    parser.add_argument("--window-months", type=int, default=24)
    parser.add_argument("--step-months", type=int, default=6)
    parser.add_argument("--json-out", help="결과 JSON 파일 저장")
    args = parser.parse_args()

    end = args.end or date.today().isoformat()

    if not args.walkforward:
        # 단일 백테스트
        print("📊 Factor Portfolio Backtest")
        print(f"   universe={args.universe}  {args.start} ~ {end}")
        print(f"   top_pct={args.top_pct}  rebalance={args.rebalance_months}m\n")
        started = time.time()
        result = factor_portfolio_backtest(
            universe=args.universe,
            start=args.start,
            end=end,
            top_pct=args.top_pct,
            rebalance_months=args.rebalance_months,
            min_stocks=args.min_stocks,
        )
        elapsed = time.time() - started
        print(f"\n✅ Done in {elapsed:.0f}s")
        m = result.get("metrics", {})
        _print_metrics_row("Factor Portfolio", m)
        if args.json_out:
            with open(args.json_out, "w") as f:
                # 큰 trade_log / equity 빼고 메트릭 + 리밸 일자만
                json.dump(
                    {
                        **{
                            k: v
                            for k, v in result.items()
                            if k not in ("trades", "equity", "benchmark")
                        },
                        "metrics": m,
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            print(f"💾 {args.json_out}")
        return

    # walk-forward
    windows = _generate_windows(args.start, end, args.window_months, args.step_months)
    if not windows:
        print("❌ 윈도우 0개 — start/end 또는 window-months 확인")
        sys.exit(1)

    print("🔁 Factor Portfolio Walk-Forward")
    print(f"   universe={args.universe}  범위 {args.start} ~ {end}")
    print(f"   window={args.window_months}m  step={args.step_months}m  → {len(windows)} 윈도우")
    print(f"   top_pct={args.top_pct}  rebalance={args.rebalance_months}m\n")

    rows: List[Dict[str, Any]] = []
    started = time.time()
    for i, (ws, we) in enumerate(windows, 1):
        print(f"▶ Window {i}/{len(windows)}: {ws} ~ {we}")
        t0 = time.time()
        result = factor_portfolio_backtest(
            universe=args.universe,
            start=ws,
            end=we,
            top_pct=args.top_pct,
            rebalance_months=args.rebalance_months,
            min_stocks=args.min_stocks,
        )
        m = result.get("metrics", {})
        elapsed = time.time() - t0
        print(
            f"  CAGR {_fmt_pct(m.get('cagr', 0))}  MDD {_fmt_pct(m.get('mdd', 0))}  "
            f"Sharpe {m.get('sharpe', 0):>5.2f}  Trades {m.get('num_trades', 0):>4d}  "
            f"({elapsed:.0f}s)"
        )
        rows.append(
            {
                "window_idx": i,
                "window_start": ws,
                "window_end": we,
                **m,
            }
        )

    total_elapsed = time.time() - started
    print(f"\n✅ Done in {total_elapsed:.0f}s\n")

    # 집계
    if rows:
        cagrs = [r["cagr"] for r in rows]
        n = len(cagrs)
        mean_c = sum(cagrs) / n
        std_c = (sum((c - mean_c) ** 2 for c in cagrs) / n) ** 0.5
        neg = sum(1 for c in cagrs if c < 0)
        print("=" * 90)
        print("📊 Walk-Forward 요약")
        print("=" * 90)
        header = f"{'#':>2}  {'period':<23}  {'CAGR':>9}  {'MDD':>9}  {'Sharpe':>7}  {'Trades':>7}"
        print(header)
        print("-" * len(header))
        for r in rows:
            print(
                f"{r['window_idx']:>2}  {r['window_start']}~{r['window_end']}  "
                f"{_fmt_pct(r['cagr']):>9}  {_fmt_pct(r['mdd']):>9}  "
                f"{r['sharpe']:>7.2f}  {r['num_trades']:>7d}"
            )
        print("-" * len(header))
        print(
            f"  Mean CAGR: {_fmt_pct(mean_c)}  (std ±{std_c * 100:.2f}%p)  |  "
            f"Negative windows: {neg}/{n}"
        )
        print("=" * 90)

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(
                {
                    "universe": args.universe,
                    "start": args.start,
                    "end": end,
                    "window_months": args.window_months,
                    "step_months": args.step_months,
                    "top_pct": args.top_pct,
                    "rebalance_months": args.rebalance_months,
                    "windows": rows,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        print(f"💾 {args.json_out}")


if __name__ == "__main__":
    main()
