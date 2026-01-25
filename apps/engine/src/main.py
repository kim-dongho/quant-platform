import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager
import threading

# 모듈 가져오기
from src.core.config import TARGET_TICKERS
from src.service.ingest import save_to_db
from src.api.routes import router
from src.core.database import init_db

def run_initial_ingestion():
    """서버 시작 시 데이터 수집을 수행하는 함수"""
    print("🚀 [Startup] Initial Data Ingestion Started...")
    init_db() # 테이블 생성
    
    for ticker in TARGET_TICKERS:
        save_to_db(ticker)
        
    print("✅ [Startup] Ingestion Completed. Ready to serve!")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. 서버 시작 전 실행할 로직
    # 데이터 수집이 오래 걸리므로 별도 스레드에서 실행 (서버 블로킹 방지)
    threading.Thread(target=run_initial_ingestion).start()
    yield

    # 2. 서버 종료 시 실행할 로직 (필요하면 추가)
    print("👋 Quant Engine Shutting Down...")

# FastAPI 앱 생성
app = FastAPI(lifespan=lifespan)

# API 라우터 등록
app.include_router(router)

if __name__ == "__main__":
    print("🔥 Starting Quant Engine API Server...")
    # Docker에서 접속 가능하게 0.0.0.0 설정
    uvicorn.run(app, host="0.0.0.0", port=8000)