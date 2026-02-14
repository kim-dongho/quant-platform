import yfinance as yf
import os

# 1. 설정
ticker = "RKLB"

# 2. 저장할 경로 설정 (apps/engine/data)
# 현재 스크립트 위치 기준으로 data 폴더를 잡거나, 실행 위치 기준 data 폴더 생성
DATA_DIR = "data"

# 폴더가 없으면 생성 (에러 방지)
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
    print(f"📁 '{DATA_DIR}' 폴더를 생성했습니다.")

# 3. 데이터 다운로드
print(f"⬇️  {ticker} 1분봉 데이터 다운로드 중...")
# period="5d": 야후 1분봉 최대치 (7일)
df = yf.download(ticker, interval="1m", period="5d")

# 4. CSV로 저장 (data 폴더 안에)
filename = f"{ticker}_1m.csv"
file_path = os.path.join(DATA_DIR, filename) # data/RKLB_1m.csv

df.to_csv(file_path)

print(f"✅ 완료! 저장 위치: {file_path}")
print(df.head())