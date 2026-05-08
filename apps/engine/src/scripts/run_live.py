"""
라이브 자동매매 1회 실행 CLI.

사용 예:
    python -u -m src.scripts.run_live              # 활성화된 paper / real 모두 실행 (기본)
    python -u -m src.scripts.run_live --mode paper # paper 만
    python -u -m src.scripts.run_live --mode real  # real 만
    python -u -m src.scripts.run_live --dry-run    # 주문 발송 없이 시뮬레이션

cron 등록 예 (월~금 KST 15:20 — 동시호가 진입 직전):
    20 15 * * 1-5  cd /path/to/repo && ./scripts/run-live.sh

활성 paper + real 둘 다 있으면 한 번 실행으로 양쪽 처리.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime

from src.service.live import run_once, run_once_all


def main() -> int:
    parser = argparse.ArgumentParser(description="Run live trading once")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="주문 발송 없이 시뮬레이션 (검증용)",
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
        result: dict = run_once_all(dry_run=args.dry_run)
        # 한쪽이라도 ok / no_strategy 면 정상 — 둘 다 에러일 때만 비정상 종료
        statuses = [v.get("status") for v in result.values() if isinstance(v, dict)]
        ok = any(s in ("ok", "no_strategy") for s in statuses)
    else:
        single = run_once(dry_run=args.dry_run, mode=args.mode)
        result = {args.mode: single}
        ok = single.get("status") in ("ok", "no_strategy")

    elapsed = (datetime.now() - started).total_seconds()
    print(f"⏱  Done in {elapsed:.1f}s")

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"💾 Saved to {args.json_out}")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
