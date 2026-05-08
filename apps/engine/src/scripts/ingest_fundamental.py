"""
펀더멘털 (분기 재무제표) ingest CLI.

흐름:
  1) --sync-codes      : DART corp_code 매핑 한 번 갱신 (재실행 거의 불필요)
  2) --universe + --years 로 백필

사용 예:
    # 첫 실행 (corp_code 매핑 + KOSPI 200 5년치)
    python -u -m src.scripts.ingest_fundamental --sync-codes --universe kospi200 --years 2020 2021 2022 2023 2024 2025

    # smoke test — 5종목만
    python -u -m src.scripts.ingest_fundamental --sync-codes --symbols 005930.KS 000660.KS 035420.KS 005380.KS 035720.KS --years 2024

    # 매월 cron — 신규 분기만 채움 + 최신 분기는 재정정 대비 갱신
    python -u -m src.scripts.ingest_fundamental --universe kospi200 --years 2020 2021 2022 2023 2024 2025 --missing-only --refresh-latest
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date

from src.service.factor import _resolve_universe
from src.service.fundamental import backfill, sync_corp_codes


def main():
    parser = argparse.ArgumentParser(description="DART 분기 재무제표 백필")
    parser.add_argument(
        "--sync-codes",
        action="store_true",
        help="DART corp_code 매핑 다운로드 (첫 실행 시 필수, 이후엔 신규 상장 대응 시에만)",
    )
    parser.add_argument(
        "--universe",
        help="kospi200 / kosdaq150 / krx350 / sp500 등 — universe 단위로 일괄 백필",
    )
    parser.add_argument(
        "--symbols",
        nargs="+",
        help="개별 종목 직접 지정 (universe 와 택1)",
    )
    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        default=None,
        help="백필 연도들 (기본: 최근 5년)",
    )
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="DB 에 이미 있는 분기는 skip (매월 cron 용 — 호출수 99% 절감)",
    )
    parser.add_argument(
        "--refresh-latest",
        action="store_true",
        help="종목별 최신 분기는 항상 re-fetch (재무제표 정정 반영)",
    )
    args = parser.parse_args()

    if args.sync_codes:
        started = time.time()
        sync_corp_codes()
        print(f"   ({time.time() - started:.1f}s)\n")

    # symbols 결정
    symbols: list[str]
    if args.symbols:
        symbols = list(args.symbols)
    elif args.universe:
        symbols = _resolve_universe(args.universe)
        if not symbols:
            print(f"❌ universe='{args.universe}' resolve 실패")
            sys.exit(1)
    else:
        if not args.sync_codes:
            print("❌ --universe 또는 --symbols 중 하나 필요 (또는 --sync-codes 단독)")
            sys.exit(1)
        return  # sync 만 하고 끝

    years = args.years or list(range(date.today().year - 5, date.today().year + 1))

    mode_label = "incremental" if args.missing_only else "full"
    print(f"📊 펀더멘털 백필 ({mode_label})")
    print(f"   종목 {len(symbols)}개 · 연도 {years} · 분기당 1회 호출")
    print(f"   예상 최대 호출: {len(symbols) * len(years) * 4}회 (DART 일 한도 40000)")
    if args.missing_only:
        print(
            f"   --missing-only: 기존 분기 skip{' + 최신은 재fetch' if args.refresh_latest else ''}"
        )
    print()

    started = time.time()
    result = backfill(
        symbols,
        years,
        progress=True,
        missing_only=args.missing_only,
        refresh_latest=args.refresh_latest,
    )
    elapsed = time.time() - started

    print()
    print("=" * 60)
    print(
        f"✅ Done in {elapsed:.0f}s — "
        f"fetched={result.get('fetch_attempts', 0)} / "
        f"ok={result['ok']} / skipped={result['skipped']} / errors={result['errors']} "
        f"(of {result['total']} planned)"
    )
    print("=" * 60)


if __name__ == "__main__":
    main()
