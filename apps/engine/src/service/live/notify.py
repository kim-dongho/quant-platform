"""
Slack 알림 모듈.

- SLACK_WEBHOOK_URL 이 비어있으면 silently skip — 로컬 dev / 알림 미사용 환경
- webhook 호출 실패해도 메인 흐름 안 죽이도록 모든 예외 swallow
- text 만 받음 (block kit 미사용 — solo 운영에 단순 markdown 으로 충분)
"""

from __future__ import annotations

import os

import requests

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "").strip()


def notify_slack(text: str) -> None:
    """Slack webhook 으로 메시지 전송. 설정 없거나 실패해도 조용히 넘김."""
    if not SLACK_WEBHOOK_URL:
        return
    try:
        requests.post(SLACK_WEBHOOK_URL, json={"text": text}, timeout=5)
    except Exception as e:
        # 알림 실패는 본 흐름을 막지 않음 — stdout 로그로만 남김
        print(f"⚠️ Slack notify failed: {e}")
