import yfinance as yf
import pandas as pd
from sqlalchemy import create_engine, text
import os

# Docker 내부 DB 주소
DB_URL = os.getenv("DB_DSN", "postgresql://user:password@db:5432/quant")
engine = create_engine(DB_URL)

def init_db():
    """테이블이 없으면 자동으로 생성하는 함수"""
    print("🛠️ Checking database schema...")
    schema_sql = """
    -- 1. 종목 테이블
    CREATE TABLE IF NOT EXISTS stocks (
        symbol VARCHAR(20) PRIMARY KEY,
        name TEXT,
        exchange VARCHAR(20),
        active BOOLEAN DEFAULT TRUE
    );

    -- 2. 시세 테이블
    CREATE TABLE IF NOT EXISTS market_data (
        time TIMESTAMPTZ NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        open DOUBLE PRECISION,
        high DOUBLE PRECISION,
        low DOUBLE PRECISION,
        close DOUBLE PRECISION,
        volume BIGINT,
        CONSTRAINT market_data_pk PRIMARY KEY (time, symbol),
        CONSTRAINT fk_stocks FOREIGN KEY (symbol) REFERENCES stocks (symbol)
    );
    
    -- 3. 인덱스
    CREATE INDEX IF NOT EXISTS ix_symbol_time_desc ON market_data (symbol, time DESC);
    """
    
    hypertable_sql = "SELECT create_hypertable('market_data', 'time', if_not_exists => TRUE);"

    with engine.connect() as conn:
        conn.execute(text(schema_sql))
        try:
            conn.execute(text(hypertable_sql))
            print("✅ Hypertable configured.")
        except Exception as e:
            # 이미 하이퍼테이블이면 에러가 날 수 있으니 무시
            print(f"ℹ️ Hypertable check: {e}")
        conn.commit()
    print("✅ Database schema initialized.")

def save_to_db(ticker):
    print(f"📥 Fetching data for {ticker}...")
    try:
        df = yf.download(ticker, period="1y", interval="1d", progress=False)
    except Exception as e:
        print(f"❌ Download failed for {ticker}: {e}")
        return

    if df.empty:
        print(f"⚠️ No data found for {ticker}")
        return

    # 데이터 전처리
    df = df.reset_index()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    rename_map = {'Date': 'time', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume'}
    df = df.rename(columns=rename_map)
    
    required_cols = ['time', 'open', 'high', 'low', 'close', 'volume']
    available_cols = [c for c in required_cols if c in df.columns]
    
    if 'time' not in available_cols:
        return

    df = df[available_cols].copy()
    df['symbol'] = ticker

    try:
        with engine.connect() as conn:
            # 종목 먼저 등록
            conn.execute(text(
                "INSERT INTO stocks (symbol, name) VALUES (:tick, :tick) ON CONFLICT (symbol) DO NOTHING"
            ), {"tick": ticker})
            conn.commit()
            
            # 데이터 저장
            df.to_sql('market_data', engine, if_exists='append', index=False, method='multi', chunksize=1000)
            print(f"✅ Saved {len(df)} rows for {ticker}")
            
    except Exception as e:
        if "unique constraint" in str(e).lower():
            print(f"ℹ️ Data for {ticker} already exists.")
        else:
            print(f"❌ DB Error for {ticker}: {e}")

# 모듈이 로드될 때 테이블 생성 함수 실행 (자동 복구)
init_db()