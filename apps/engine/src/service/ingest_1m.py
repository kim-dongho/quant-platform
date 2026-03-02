import yfinance as yf
import pandas as pd
from sqlalchemy import text, Table, MetaData
from sqlalchemy.dialects.postgresql import insert
from src.core.database import engine

metadata = MetaData()

def save_1m_to_db(ticker: str):
    """
    yfinance를 통해 1분봉 데이터를 수집하고, 
    market_data_1m 테이블에 저장합니다.
    """
    print(f"⏱️ Fetching 1-minute data for {ticker}...")
    
    try:
        t = yf.Ticker(ticker)
        # 💡 핵심: 1분봉, 최근 5일치 (야후 무료 API 최대 제공량)
        df = t.history(interval="1m", period="5d")
        
    except Exception as e:
        print(f"❌ API Fetch failed for {ticker}: {e}")
        return

    if df.empty:
        print(f"⚠️ No 1m data found for {ticker}")
        return

    # --- 데이터 전처리 ---
    df = df.reset_index()
    
    # yfinance 최신 버전 MultiIndex 평탄화 방어
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    # 분봉 데이터는 인덱스 이름이 'Datetime'으로 들어옴
    rename_map = {
        'Date': 'time', 'Datetime': 'time', 
        'Open': 'open', 'High': 'high', 
        'Low': 'low', 'Close': 'close', 'Volume': 'volume'
    }

    df = df.rename(columns=rename_map)
    df['symbol'] = ticker

    # 필요한 컬럼만 추출해서 딕셔너리 리스트로 변환
    data_to_insert = df[['time', 'symbol', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')

    try:
        with engine.connect() as conn:
            # 1. 1분봉 전용 테이블 생성 (없을 경우에만 만들어짐)
            # 타임존 포함된 시간(TIMESTAMPTZ)을 사용해 글로벌 주식장 시간 꼬임 방지
            create_table_sql = text("""
                CREATE TABLE IF NOT EXISTS market_data_1m (
                    time TIMESTAMPTZ NOT NULL,
                    symbol VARCHAR(20) NOT NULL,
                    open DOUBLE PRECISION,
                    high DOUBLE PRECISION,
                    low DOUBLE PRECISION,
                    close DOUBLE PRECISION,
                    volume DOUBLE PRECISION,
                    PRIMARY KEY (time, symbol)
                );
            """)
            conn.execute(create_table_sql)
            conn.commit()

            # 2. 1분봉 데이터 꽂아넣기 (중복 데이터 무시)
            market_data_1m_table = Table('market_data_1m', metadata, autoload_with=engine)
            stmt = insert(market_data_1m_table).values(data_to_insert)
            
            # 이미 수집된 시간의 데이터는 덮어쓰지 않고 패스 (ON CONFLICT DO NOTHING)
            stmt = stmt.on_conflict_do_nothing(index_elements=['time', 'symbol'])
            
            conn.execute(stmt)
            conn.commit()
            print(f"✅ Saved {len(df)} 1m candle rows for {ticker}")
            
    except Exception as e:
        print(f"❌ DB Write Error for {ticker}: {e}")
        conn.rollback()
