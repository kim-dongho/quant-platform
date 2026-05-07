#!/usr/bin/env bash
# 일 단위 DB 백업 — quant-db 컨테이너의 pg_dump → gzip → /root/quant-backups
# 7일 이상 된 파일은 자동 삭제 (rotation). cron 으로 새벽 3시 실행 권장.
#
# cron 등록:
#   0 3 * * *  /root/quant-platform/scripts/backup-db.sh > /dev/null 2>&1
#
# 복원:
#   gunzip -c /root/quant-backups/quant-20260507-030000.sql.gz | \
#     docker exec -i quant-db psql -U user -d quant
set -euo pipefail

BACKUP_DIR=/root/quant-backups
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/quant-$DATE.sql.gz"

# pg_dump 가 실패하면 set -e 로 즉시 종료 — Slack 알림은 그 다음 trap 에서.
notify() {
    local msg="$1"
    docker exec -i quant-engine python -c \
        "from src.service.live.notify import notify_slack; notify_slack('''$msg''')" \
        2>/dev/null || true
}

trap 'notify "❌ *DB 백업 실패* — $BACKUP_FILE"; exit 1' ERR

# pg_dump (custom format 대신 plain SQL — 텍스트라 grep / diff 가능)
docker exec -i quant-db pg_dump -U user -d quant | gzip -9 > "$BACKUP_FILE"

# 정상 백업 후에만 rotation — 실패해도 옛 백업은 보존
find "$BACKUP_DIR" -name 'quant-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
COUNT=$(find "$BACKUP_DIR" -name 'quant-*.sql.gz' | wc -l | tr -d ' ')
notify "✅ *DB 백업 완료* — $SIZE ($COUNT개 보존중)"
