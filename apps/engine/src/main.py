import os

import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager

from src.api.routers import api_router
from src.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # prod DB 를 원격으로 바라보는 로컬 dev 환경에선 끄는 게 안전.
    # default=true 라 운영 (VPS) 에선 자동으로 schema 적용됨.
    if os.getenv("INIT_DB_ON_STARTUP", "true").lower() in ("1", "true", "yes"):
        print("🛠️ Initializing DB schema...")
        init_db()
        print("✅ Schema ready. To populate data, run: ./scripts/ingest-universe.sh")
    else:
        print("⏭️  INIT_DB_ON_STARTUP=false — skipping schema init (remote DB mode)")
    yield
    print("👋 Quant Engine Shutting Down...")


# FastAPI 앱 생성
app = FastAPI(lifespan=lifespan)

# API 라우터 등록 — 도메인별 router 통합본
app.include_router(api_router)

if __name__ == "__main__":
    print("🔥 Starting Quant Engine API Server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
