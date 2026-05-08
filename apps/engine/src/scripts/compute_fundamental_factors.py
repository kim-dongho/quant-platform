"""
일별 펀더멘털 factor 백필 CLI.

흐름:
  1) market_data + fundamental_data 결합
  2) 각 (symbol, trading_date) 별로 PBR/PER/ROE/부채비율/영업이익률/총자산회전율 계산
  3) fundamental_factors 테이블에 upsert

사용 예:
    # KOSPI 200 × 6년 풀 백필 (수십 초)
    python -u -m src.scripts.compute_fundamental_factors --universe kospi200 --start 2020-01-01

    # 특정 종목 / 기간
    python -u -m src.scripts.compute_fundamental_factors --symbols 005930.KS --start 2024-01-01

매월 cron — 분기 ingest 끝나고 factor 갱신:
    ./scripts/ingest-fundamental.sh ... && \
        ./scripts/compute-fundamental-factors.sh --universe kospi200 --start 2020-01-01
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date

from src.service.factor import _resolve_universe
from src.service.fundamental import backfill_factors


def main():
    parser = argparse.ArgumentParser(description="일별 펀더멘털 factor 계산 + 저장")
    parser.add_argument("--universe", help="kospi200 / sp500 등")
    parser.add_argument("--symbols", nargs="+", help="개별 종목 (universe 와 택1)")
    parser.add_argument("--start", default="2020-01-01", help="시작일 (기본 2020-01-01)")
    parser.add_argument("--end", default=None, help="끝일 (기본 오늘)")
    args = parser.parse_args()

    if args.symbols:
        symbols = list(args.symbols)
    elif args.universe:
        symbols = _resolve_universe(args.universe)
        if not symbols:
            print(f"❌ universe='{args.universe}' resolve 실패")
            sys.exit(1)
    else:
        print("❌ --universe 또는 --symbols 필요")
        sys.exit(1)

    end = args.end or date.today().isoformat()
    print("🧮 fundamental_factors 백필")
    print(f"   종목 {len(symbols)}개 · {args.start} ~ {end}")
    print()

    started = time.time()
    result = backfill_factors(symbols, args.start, end)
    elapsed = time.time() - started

    print()
    print("=" * 60)
    print(f"✅ Done in {elapsed:.0f}s — computed={result['computed']} / saved={result['saved']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
