#!/usr/bin/env bash
# Bulk universe ingestion — 미국은 yfinance, 국내(.KS/.KQ)는 FinanceDataReader 자동 분기.
# 엔진 컨테이너 내부에서 실행되며, 모든 인자는 그대로 Python script에 전달됩니다.
#
# 사용 예:
#   ./scripts/ingest-universe.sh                              # 기본: 미국(R1000∪R2000∪NDX100+SPY) + 국내(KRX 350)
#   ./scripts/ingest-universe.sh --universe sp500             # 미국 SP500만
#   ./scripts/ingest-universe.sh --universe nasdaq100         # 미국 NASDAQ 100만
#   ./scripts/ingest-universe.sh --universe kospi200          # 국내 KOSPI 200만
#   ./scripts/ingest-universe.sh --universe krx350            # 국내 KOSPI200 + KOSDAQ150
#   ./scripts/ingest-universe.sh --universe sp500 --limit 200 # 처음 200종목 테스트
#   ./scripts/ingest-universe.sh --tickers-file /tmp/my.txt
#
# 백그라운드로 돌리고 싶으면:
#   nohup ./scripts/ingest-universe.sh > /dev/null 2>&1 &
#   (로그는 아래 LOG_FILE 경로에 남습니다)
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/scripts/logs"
LOG_FILE="$LOG_DIR/ingest-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

# 엔진 컨테이너 상태 확인
if ! docker-compose ps engine 2>/dev/null | grep -q "Up"; then
    echo "❌ engine 컨테이너가 실행 중이 아닙니다. 먼저: docker-compose up -d"
    exit 1
fi

echo "🚀 Bulk ingestion 시작"
echo "   로그: $LOG_FILE"
echo "   중단: Ctrl+C (컨테이너 내부 프로세스는 계속 돕니다 — 완전 중단은 docker-compose restart engine)"
echo ""

docker-compose exec -T engine python -u -m src.scripts.ingest_bulk "$@" 2>&1 | tee "$LOG_FILE"
