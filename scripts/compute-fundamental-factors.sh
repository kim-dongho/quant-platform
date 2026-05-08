#!/usr/bin/env bash
# 일별 펀더멘털 factor 계산 — fundamental_data + market_data → fundamental_factors.
# 분기 ingest 후 또는 신규 거래일 채워질 때마다 실행.
#
# 사용 예:
#   ./scripts/compute-fundamental-factors.sh --universe kospi200 --start 2020-01-01
#   ./scripts/compute-fundamental-factors.sh --symbols 005930.KS --start 2024-01-01
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/scripts/logs"
LOG_FILE="$LOG_DIR/fundfactors-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

if ! docker-compose ps engine 2>/dev/null | grep -q "Up"; then
    echo "❌ engine 컨테이너가 실행 중이 아닙니다. 먼저: docker-compose up -d"
    exit 1
fi

echo "🧮 펀더멘털 factor 계산 시작"
echo "   로그: $LOG_FILE"
echo ""

docker-compose exec -T engine python -u -m src.scripts.compute_fundamental_factors "$@" 2>&1 | tee "$LOG_FILE"
