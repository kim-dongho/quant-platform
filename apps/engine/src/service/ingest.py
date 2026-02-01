import yfinance as yf
import pandas as pd
from sqlalchemy import text, Table, MetaData
from sqlalchemy.dialects.postgresql import insert
from src.core.database import engine

metadata = MetaData()

def save_to_db(ticker: str):
    """
    yfinance를 통해 데이터를 수집하고, 
    stocks 테이블(회사명)과 market_data 테이블(시세)을 업데이트합니다.
    """
    print(f"📥 Processing data for {ticker}...")
    
    try:
        # 1. Ticker 객체 생성 및 메타데이터 추출
        t = yf.Ticker(ticker)
        
        # 회사 이름 추출 (longName -> shortName -> ticker 순서)
        company_name = t.info.get('longName') or t.info.get('shortName') or ticker
        print(f"🏢 Company: {company_name}")

        # 2. 시세 데이터 다운로드 (최대 기간)
        df = t.history(period="max")
        
    except Exception as e:
        print(f"❌ API Fetch failed for {ticker}: {e}")
        return

    if df.empty:
        print(f"⚠️ No data found for {ticker}")
        return

    # --- 데이터 전처리 (기본 포맷팅) ---
    df = df.reset_index()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]

    # DB 컬럼명에 맞게 변경
    rename_map = {
        'Date': 'time', 'Open': 'open', 'High': 'high', 
        'Low': 'low', 'Close': 'close', 'Volume': 'volume'
    }

    df = df.rename(columns=rename_map)
    df['symbol'] = ticker
    
    # 필요한 컬럼만 추출
    data_to_insert = df[['time', 'symbol', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')

    try:
        with engine.connect() as conn:
            # 1. stocks 테이블 Upsert (회사명 최신화)
            stock_stmt = text("""
                INSERT INTO stocks (symbol, name) 
                VALUES (:tick, :name) 
                ON CONFLICT (symbol) 
                DO UPDATE SET name = EXCLUDED.name
            """)
            conn.execute(stock_stmt, {"tick": ticker, "name": company_name})
            conn.commit()
            
            # 2. market_data 테이블 저장 (중복 데이터 무시)
            if data_to_insert:
                market_data_table = Table('market_data', metadata, autoload_with=engine)
                stmt = insert(market_data_table).values(data_to_insert)
                stmt = stmt.on_conflict_do_nothing(index_elements=['time', 'symbol'])
                
                conn.execute(stmt)
                conn.commit()
                print(f"✅ Saved {len(df)} rows for {ticker} ({company_name})")
            
    except Exception as e:
        print(f"❌ DB Write Error for {ticker}: {e}")