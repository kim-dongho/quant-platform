import yfinance as yf
import pandas as pd
from sqlalchemy import text, Table, MetaData
from sqlalchemy.dialects.postgresql import insert
from src.core.config import is_krx_symbol
from src.core.database import engine

metadata = MetaData()

def save_to_db(ticker: str):
    """
    단일 종목 시세·회사명 수집 진입점. 티커 포맷을 보고 자동 분기한다.
      - '.KS' / '.KQ' 접미사 → FinanceDataReader (국내)
      - 그 외 → yfinance (미국)
    """
    if is_krx_symbol(ticker):
        from src.service.ingest.krx import save_krx_to_db
        return save_krx_to_db(ticker)

    print(f"📥 Processing data for {ticker}...")

    try:
        t = yf.Ticker(ticker)
        
        # 1. 회사명 추출 (야후 API 억까 방어 로직)
        company_name = None
        try:
            info = t.info
            # 정상적으로 가져왔을 때만 저장
            if info: 
                company_name = info.get('longName') or info.get('shortName')
        except Exception as e:
            print(f"⚠️ Info fetch failed (야후 차단): {e}")
            
        # 콘솔 출력용 (구했으면 이름, 못 구했으면 티커)
        display_name = company_name or ticker
        print(f"🏢 Company: {display_name}")

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

    rename_map = {
        'Date': 'time', 'Open': 'open', 'High': 'high', 
        'Low': 'low', 'Close': 'close', 'Volume': 'volume'
    }

    df = df.rename(columns=rename_map)
    df['symbol'] = ticker
    
    data_to_insert = df[['time', 'symbol', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')

    try:
        with engine.connect() as conn:
            # 3. stocks 테이블 업데이트 (방어 로직 적용)
            if company_name:
                # 진짜 이름을 구해왔을 때만 업데이트
                stock_stmt = text("""
                    INSERT INTO stocks (symbol, name) 
                    VALUES (:tick, :name) 
                    ON CONFLICT (symbol) 
                    DO UPDATE SET name = EXCLUDED.name
                """)
                conn.execute(stock_stmt, {"tick": ticker, "name": company_name})
            else:
                # 이름을 못 구했으면 새로 넣기만 하고, 기존 데이터는 절대 안 건드림
                stock_stmt = text("""
                    INSERT INTO stocks (symbol, name) 
                    VALUES (:tick, :tick) 
                    ON CONFLICT (symbol) 
                    DO NOTHING
                """)
                conn.execute(stock_stmt, {"tick": ticker})
            
            # 4. market_data 테이블 저장 (중복 데이터 무시)
            if data_to_insert:
                market_data_table = Table('market_data', metadata, autoload_with=engine)
                stmt = insert(market_data_table).values(data_to_insert)
                stmt = stmt.on_conflict_do_nothing(index_elements=['time', 'symbol'])
                
                conn.execute(stmt)
                conn.commit()
                print(f"✅ Saved {len(df)} rows for {ticker} ({display_name})")

    except Exception as e:
        print(f"❌ DB Write Error for {ticker}: {e}")
        conn.rollback() # 트랜잭션 꼬임 방지
        return

    # 시세 저장이 끝나면 팩터 precompute (포트폴리오 스크리닝용)
    try:
        from src.service.factor import compute_factors_for_symbol
        n = compute_factors_for_symbol(ticker)
        if n:
            print(f"📊 Factors updated: {n} rows for {ticker}")
    except Exception as e:
        print(f"⚠️ Factor computation skipped for {ticker}: {e}")