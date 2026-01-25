FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

# 빌드 필수 패키지 설치 (Postgres 라이브러리용)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# pip 업그레이드
RUN pip install --upgrade pip

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY . .

# -u 옵션: 로그가 버퍼링 없이 바로 출력되게 함 (디버깅 필수)
CMD ["python", "-u", "src/main.py"]