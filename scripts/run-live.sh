#!/usr/bin/env bash
# 라이브 자동매매 1회 실행 — engine 컨테이너 안에서 run_live 모듈 호출.
# 인자는 그대로 Python으로 전달 (예: --dry-run).
#
# cron 등록 예 (월~금 KST 15:20):
#   20 15 * * 1-5  cd /path/to/repo && ./scripts/run-live.sh > /dev/null 2>&1
#
# 로그는 자동으로 LOG_FILE 경로에 저장됨.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/scripts/logs"
LOG_FILE="$LOG_DIR/live-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

# 엔진 컨테이너 상태 확인
if ! docker-compose ps engine 2>/dev/null | grep -q "Up"; then
    echo "❌ engine 컨테이너가 실행 중이 아닙니다. 먼저: docker-compose up -d" | tee "$LOG_FILE"
    exit 1
fi

echo "🤖 Live trading run 시작"
echo "   로그: $LOG_FILE"
echo ""

docker-compose exec -T engine python -u -m src.scripts.run_live "$@" 2>&1 | tee "$LOG_FILE"
