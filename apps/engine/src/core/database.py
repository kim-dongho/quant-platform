import os
from sqlalchemy import create_engine, text

# 1. DB 주소 설정 (환경변수에서 읽어오거나 기본값 사용)
DB_URL = os.getenv("DB_DSN", "postgresql://user:password@db:5432/quant")

# 2. 전역 engine 객체 생성
engine = create_engine(DB_URL, pool_pre_ping=True)

def init_db():
    """파일에서 SQL을 읽어와 스키마를 동기화합니다."""
    print("🛠️ Synchronizing database schema from migrations/schema.sql...")
    
    # 3. 경로 설정
    project_root = os.getenv("PYTHONPATH", "/app")
    sql_path = os.path.join(project_root, 'migrations', 'schema.sql')  
    
    try:
        with open(sql_path, 'r') as f:
            schema_sql = f.read()

        # 4. engine을 사용하여 SQL 실행
        with engine.connect() as conn:
            # text(schema_sql)은 전체를 하나의 구문으로 인식하므로 주의가 필요할 수 있습니다.
            conn.execute(text(schema_sql))
            
            # TimescaleDB 하이퍼테이블 설정 (이미 존재하면 무시)
            try:
                conn.execute(text("SELECT create_hypertable('market_data', 'time', if_not_exists => TRUE);"))
            except Exception:
                pass
            
            conn.commit()
        print("✅ Database schema initialized successfully.")
        
    except FileNotFoundError:
        print(f"❌ Error: schema.sql not found at {sql_path}")
    except Exception as e:
        print(f"❌ Error during init_db: {e}")