"""
보유 종목 stop-loss 재발사 전용 CLI — 매수/매도 phase 없음.

배경:
  KIS 정규주문 (ORD_DVSN=22 스탑지정가 포함) 은 당일 유효 — 정규장 마감 시
  자동 취소됨. 매매 cron (15:15) 에서 stop 을 발사해도 다음날 09:00 장
  시작 전에 만료. 매일 정규장 시작 시점에 재발사가 필요.

사용 예:
    python -u -m src.scripts.run_stop_only              # paper / real 모두 재발사 (기본)
    python -u -m src.scripts.run_stop_only --mode real  # real 만
    python -u -m src.scripts.run_stop_only --dry-run    # 발사 없이 시뮬

cron 등록 예 (월~금 KST 09:00 — 정규장 시작 직후):
    0 9 * * 1-5  cd /path/to/repo && ./scripts/run-stop-only.sh
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime

from src.service.live import run_stop_refresh, run_stop_refresh_all


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh stop-loss orders only")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 KIS 주문 발사 없이 시뮬 (검증용)",
    )
    parser.add_argument(
        "--mode",
        choices=["paper", "real", "all"],
        default="all",
        help="실행 mode (기본 all = paper + real 모두)",
    )
    parser.add_argument(
        "--json-out",
        help="결과를 JSON 파일로도 저장",
    )
    args = parser.parse_args()

    started = datetime.now()
    print(f"⏱  Started at {started.isoformat(timespec='seconds')}")

    if args.mode == "all":
        result: dict = run_stop_refresh_all(dry_run=args.dry_run)
        statuses = [v.get("status") for v in result.values() if isinstance(v, dict)]
        ok = any(s in ("ok", "no_strategy", "no_policy") for s in statuses)
    else:
        single = run_stop_refresh(dry_run=args.dry_run, mode=args.mode)
        result = {args.mode: single}
        ok = single.get("status") in ("ok", "no_strategy", "no_policy")

    elapsed = (datetime.now() - started).total_seconds()
    print(f"⏱  Done in {elapsed:.1f}s")

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"💾 Saved to {args.json_out}")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
