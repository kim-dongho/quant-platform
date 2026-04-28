"""
라이브 자동매매 1회 실행 CLI.

사용 예:
    python -u -m src.scripts.run_live              # 실거래 (KIS 모드 따름)
    python -u -m src.scripts.run_live --dry-run    # 주문 발송 없이 시뮬레이션

cron 등록 예 (월~금 KST 15:20 — 동시호가 진입 직전):
    20 15 * * 1-5  cd /path/to/repo && ./scripts/run-live.sh
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime

from src.service.live_executor import run_once


def main() -> int:
    parser = argparse.ArgumentParser(description="Run live trading once")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="주문 발송 없이 시뮬레이션 (검증용)",
    )
    parser.add_argument(
        "--json-out",
        help="결과를 JSON 파일로도 저장",
    )
    args = parser.parse_args()

    started = datetime.now()
    print(f"⏱  Started at {started.isoformat(timespec='seconds')}")

    result = run_once(dry_run=args.dry_run)

    elapsed = (datetime.now() - started).total_seconds()
    print(f"⏱  Done in {elapsed:.1f}s")

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"💾 Saved to {args.json_out}")

    # cron이 비정상 종료를 잡을 수 있게 status에 따라 exit code 분기
    return 0 if result.get("status") in ("ok", "no_strategy") else 1


if __name__ == "__main__":
    sys.exit(main())
