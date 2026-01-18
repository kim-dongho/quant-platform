import time
import ingest # 방금 만든 모듈

def main():
    print("🚀 Quant Engine Started...")
    
    # 관심 종목 리스트 (사용자 취향 반영)
    my_tickers = ["RKLB", "ASTS", "SOUN", "PLTR", "TSLA"]
    
    print("--- Initial Data Ingestion ---")
    for t in my_tickers:
        ingest.save_to_db(t)
    print("------------------------------")

    # 서버가 꺼지지 않게 유지 (나중에 Redis 큐 리스너가 들어갈 자리)
    while True:
        print("zzz... (Worker is idle)")
        time.sleep(60)

if __name__ == "__main__":
    main()