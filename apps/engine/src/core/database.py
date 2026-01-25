from sqlalchemy import create_engine
from src.core.config import DB_URL

# 전역 DB 엔진 객체 생성
engine = create_engine(DB_URL)