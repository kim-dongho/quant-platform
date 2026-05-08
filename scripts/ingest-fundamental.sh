#!/usr/bin/env bash
# 펀더멘털 (분기 재무제표) ingest — DART API → fundamental_data.
# 엔진 컨테이너 내부에서 실행되며, 모든 인자는 그대로 Python script에 전달됩니다.
#
# 사용 예:
#   # 첫 실행 (corp_code 매핑 + KOSPI 200 5년치 풀 백필 — 약 14분)
#   ./scripts/ingest-fundamental.sh --sync-codes --universe kospi200 \
#     --years 2020 2021 2022 2023 2024 2025
#
#   # 매월 cron — 신규 분기만 + 최신 분기 갱신 (약 40초)
#   ./scripts/ingest-fundamental.sh --universe kospi200 \
#     --years 2020 2021 2022 2023 2024 2025 --missing-only --refresh-latest
#
#   # 신규 종목 추가됐을 때
#   ./scripts/ingest-fundamental.sh --sync-codes
#
# cron 등록 (매월 15일 03시 — Q1 5/15, Q2 8/15, Q3 11/15 보고서 들어올 즈음):
#   0 3 15 * * cd /home/$USER/quant && ./scripts/ingest-fundamental.sh \
#     --universe kospi200 --years 2020 2021 2022 2023 2024 2025 \
#     --missing-only --refresh-latest > /dev/null 2>&1
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/scripts/logs"
LOG_FILE="$LOG_DIR/ingest-fundamental-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

if ! docker-compose ps engine 2>/dev/null | grep -q "Up"; then
    echo "❌ engine 컨테이너가 실행 중이 아닙니다. 먼저: docker-compose up -d"
    exit 1
fi

echo "📊 펀더멘털 ingest 시작"
echo "   로그: $LOG_FILE"
echo ""

docker-compose exec -T engine python -u -m src.scripts.ingest_fundamental "$@" 2>&1 | tee "$LOG_FILE"
