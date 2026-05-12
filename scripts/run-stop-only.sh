#!/usr/bin/env bash
# 보유 종목 stop-loss 재발사 — engine 컨테이너 안에서 run_stop_only 모듈 호출.
# KIS 정규주문 (스탑지정가 포함) 이 당일 유효라 매일 정규장 시작 시 다시 발사.
#
# cron 등록 예 (월~금 KST 09:00):
#   0 9 * * 1-5  cd /path/to/repo && ./scripts/run-stop-only.sh > /dev/null 2>&1
#
# 로그는 자동으로 LOG_FILE 경로에 저장됨.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/scripts/logs"
LOG_FILE="$LOG_DIR/stop-only-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

if ! docker-compose ps engine 2>/dev/null | grep -q "Up"; then
    echo "❌ engine 컨테이너가 실행 중이 아닙니다. 먼저: docker-compose up -d" | tee "$LOG_FILE"
    exit 1
fi

echo "🛡️  Stop refresh 시작"
echo "   로그: $LOG_FILE"
echo ""

docker-compose exec -T engine python -u -m src.scripts.run_stop_only "$@" 2>&1 | tee "$LOG_FILE"
