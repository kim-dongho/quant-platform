"""
전략 자동 탐색 CLI.

사용 예:
    python -u -m src.scripts.discover                          # 1-clause 풀 grid
    python -u -m src.scripts.discover --n-clauses 2            # 2-clause AND
    python -u -m src.scripts.discover --universe sp500 --top-n 10
    python -u -m src.scripts.discover --quick                  # smoke test
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from src.service.strategy_discover import (
    DEFAULT_FACTORS,
    DEFAULT_OPS,
    DEFAULT_PERCENTILES,
    discover,
)


def _fmt_pct(v: float) -> str:
    return f"{v * 100:>6.2f}%"


def _format_clauses(clauses: list[dict]) -> str:
    return " & ".join(f"{c['factor']} {c['op']} {c['value']:.3f}" for c in clauses)


def _print_table(top: list[dict]) -> None:
    if not top:
        print("\n(결과 없음 — train·test 모두에서 양수 Sharpe + 벤치마크 초과수익(α>0)인 조합이 없었습니다.)")
        return

    print()
    header = (
        f"{'#':>2}  {'Rule':<55} | "
        f"{'TrSh':>5} {'TrCAGR':>8} {'Trα':>7} {'TrxCAGR':>8} {'TrMDD':>8} {'TrTr':>5} | "
        f"{'TeSh':>5} {'TeCAGR':>8} {'Teα':>7} {'TexCAGR':>8} {'TeMDD':>8} {'TeTr':>5}"
    )
    print(header)
    print("-" * len(header))
    for i, r in enumerate(top, 1):
        rule = _format_clauses(r["clauses"])
        if len(rule) > 55:
            rule = rule[:52] + "..."
        print(
            f"{i:>2}  {rule:<55} | "
            f"{r['train_sharpe']:>5.2f} {_fmt_pct(r['train_cagr'])} "
            f"{_fmt_pct(r['train_alpha'])} {_fmt_pct(r['train_excess_cagr'])} "
            f"{_fmt_pct(r['train_mdd'])} {r['train_trades']:>5} | "
            f"{r['test_sharpe']:>5.2f} {_fmt_pct(r['test_cagr'])} "
            f"{_fmt_pct(r['test_alpha'])} {_fmt_pct(r['test_excess_cagr'])} "
            f"{_fmt_pct(r['test_mdd'])} {r['test_trades']:>5}"
        )


def main():
    parser = argparse.ArgumentParser(description="Grid search for strategy rules")
    parser.add_argument(
        "--universe", default="krx350", help="투자 대상 (기본 krx350 — KOSPI200+KOSDAQ150)"
    )
    parser.add_argument(
        "--n-clauses",
        type=int,
        choices=[1, 2],
        default=1,
        help="조건 개수: 1 = 단일 절, 2 = 다른 factor끼리 AND",
    )
    parser.add_argument(
        "--factors",
        nargs="+",
        default=None,
        help=f"시도할 factor 이름들 (기본: {DEFAULT_FACTORS})",
    )
    parser.add_argument("--ops", nargs="+", default=None, help=f"비교 연산자 (기본: {DEFAULT_OPS})")
    parser.add_argument("--start", help="기간 시작 YYYY-MM-DD (기본: end - 10년)")
    parser.add_argument("--end", help="기간 끝 YYYY-MM-DD (기본: 오늘)")
    parser.add_argument("--train-ratio", type=float, default=0.7, help="train 비율 (기본 0.7)")
    parser.add_argument("--max-positions", type=int, default=10)
    parser.add_argument("--top-n", type=int, default=5)
    parser.add_argument(
        "--quick",
        action="store_true",
        help="smoke test 모드: factor 1개·percentile 2개만 시도",
    )
    parser.add_argument("--json-out", help="결과를 JSON 파일로도 저장")
    args = parser.parse_args()

    factors = args.factors or DEFAULT_FACTORS
    ops = args.ops or DEFAULT_OPS
    percentiles = DEFAULT_PERCENTILES

    if args.quick:
        factors = factors[:1]
        percentiles = [0.3, 0.7]
        print(f"⚡ Quick mode: factor={factors}, percentiles={percentiles}")

    print(f"🔍 Discovering on universe={args.universe} (n_clauses={args.n_clauses})")
    print(f"   factors={factors}")
    print(f"   ops={ops}")
    print(f"   percentiles={percentiles}\n")

    started = time.time()

    def progress(done: int, total: int, label: str):
        elapsed = time.time() - started
        eta = (elapsed / done) * (total - done) if done > 0 else 0
        # 너무 긴 label 자르기
        short = label[:50]
        sys.stdout.write(
            f"\r  [{done}/{total}] {short:<50} · elapsed {elapsed:.0f}s · ETA {eta:.0f}s"
        )
        sys.stdout.flush()

    result = discover(
        universe=args.universe,
        factors=factors,
        ops=ops,
        percentiles=percentiles,
        start_date=args.start,
        end_date=args.end,
        train_ratio=args.train_ratio,
        max_positions=args.max_positions,
        n_clauses=args.n_clauses,
        top_n=args.top_n,
        progress_cb=progress,
    )
    elapsed = time.time() - started
    print(
        f"\n\n✅ Done in {elapsed:.0f}s — evaluated={result['evaluated']}, skipped={result['skipped']}"
    )

    p = result["params"]
    print(f"   train: {p['train_period'][0]} ~ {p['train_period'][1]}")
    print(f"   test:  {p['test_period'][0]} ~ {p['test_period'][1]}")

    print(f"\n🏆 Top {len(result['top'])}:")
    _print_table(result["top"])

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Saved to {args.json_out}")


if __name__ == "__main__":
    main()
