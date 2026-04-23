import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager

from src.api.routes import router
from src.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 스키마만 초기화 — 데이터 수집은 scripts/ingest-universe.sh 로 별도 실행
    print("🛠️ Initializing DB schema...")
    init_db()
    print("✅ Schema ready. To populate data, run: ./scripts/ingest-universe.sh")
    yield
    print("👋 Quant Engine Shutting Down...")


# FastAPI 앱 생성
app = FastAPI(lifespan=lifespan)

# API 라우터 등록
app.include_router(router)

if __name__ == "__main__":
    print("🔥 Starting Quant Engine API Server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
