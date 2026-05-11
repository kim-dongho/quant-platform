#!/usr/bin/env bash
# VPS Postgres 로 SSH tunnel — 로컬에서 prod DB 바라보기 위한 헬퍼.
#
# 사용:
#   ./scripts/tunnel.sh start   # autossh 백그라운드 기동 (localhost:15432 → vps:5432)
#   ./scripts/tunnel.sh stop    # 종료
#   ./scripts/tunnel.sh status  # 현재 상태
#
# 사전 준비:
#   1. ~/.ssh/config 에 'quant-vps' Host alias 등록 (HostName / User / IdentityFile)
#   2. autossh 설치 (`brew install autossh`)

set -euo pipefail

SSH_ALIAS="${SSH_ALIAS:-quant-vps}"
LOCAL_PORT="${LOCAL_PORT:-15432}"
REMOTE_PORT="${REMOTE_PORT:-5432}"
PIDFILE="/tmp/quant-tunnel-${LOCAL_PORT}.pid"

cmd="${1:-status}"

case "$cmd" in
    start)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "✅ Tunnel already running (pid $(cat "$PIDFILE"))"
            exit 0
        fi
        if ! command -v autossh >/dev/null 2>&1; then
            echo "❌ autossh not installed — run: brew install autossh" >&2
            exit 1
        fi
        echo "🔌 Starting tunnel: localhost:${LOCAL_PORT} → ${SSH_ALIAS}:${REMOTE_PORT}"
        autossh -fN -M 0 \
            -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" \
            -o "ExitOnForwardFailure=yes" \
            -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}" \
            "$SSH_ALIAS"
        # autossh 는 fork 후 PID 를 직접 안 알려주므로 pgrep 으로 잡기
        sleep 1
        pgrep -f "autossh.*-L ${LOCAL_PORT}:localhost:${REMOTE_PORT}" > "$PIDFILE" || true
        echo "✅ Tunnel up (pid $(cat "$PIDFILE" 2>/dev/null || echo '?'))"
        ;;
    stop)
        if [ -f "$PIDFILE" ]; then
            pid=$(cat "$PIDFILE")
            kill "$pid" 2>/dev/null && echo "🛑 Tunnel stopped (pid $pid)" || echo "⚠️  pid $pid not alive"
            rm -f "$PIDFILE"
        fi
        # 안전망 — pgrep 으로 남은 프로세스도 정리
        pkill -f "autossh.*-L ${LOCAL_PORT}:localhost:${REMOTE_PORT}" 2>/dev/null || true
        ;;
    status)
        if pgrep -f "autossh.*-L ${LOCAL_PORT}:localhost:${REMOTE_PORT}" >/dev/null; then
            echo "✅ Tunnel up — localhost:${LOCAL_PORT} → ${SSH_ALIAS}:${REMOTE_PORT}"
            pgrep -af "autossh.*-L ${LOCAL_PORT}"
        else
            echo "⏸️  Tunnel down"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|status}" >&2
        exit 2
        ;;
esac
