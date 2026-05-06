#!/usr/bin/env bash
# VPS 자동 배포 — GitHub Actions self-hosted runner 가 호출.
# /root/quant-platform 의 git tree 를 origin/dev 로 fast-forward 후 api/engine 만 rebuild.
set -euo pipefail

REPO_DIR=/root/quant-platform
cd "$REPO_DIR"

echo "🔄 git fetch..."
git fetch --quiet origin dev

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/dev)
if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Already up to date ($LOCAL)"
    exit 0
fi

echo "📥 Pulling $LOCAL → $REMOTE"
git reset --hard origin/dev

echo "🔨 docker compose build + up..."
docker compose up -d --build api engine

echo "📋 Status:"
docker compose ps
echo "✅ Deploy done"
