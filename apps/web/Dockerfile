FROM node:20-alpine

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 의존성 설치
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# 소스 복사
COPY . .

# 개발 서버 실행
CMD ["pnpm", "dev"]