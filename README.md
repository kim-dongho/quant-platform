# 📈 Quant Trading Platform

> **개인용 자가호스팅 퀀트 트레이딩 플랫폼.**
> 미국·국내 주식 10년치 데이터로 매매 룰을 백테스트하고, **Grid search 로 검증된 룰**을
> 한국투자증권(KIS) 모의·실전 계좌에서 **cron 자동 매매**까지 한 흐름으로 운영합니다.

![CI](https://github.com/kim-dongho/quant-platform/actions/workflows/ci.yml/badge.svg?branch=dev)
![Status](https://img.shields.io/badge/Status-In%20Development-green)
![Self-Host](https://img.shields.io/badge/Self--Host-docker--compose-informational)
![License](https://img.shields.io/badge/License-MIT-blue)

![Hero](./docs/images/screenshots/hero.png)

## 목차

1. [개요](#1-개요)
2. [시스템 구조](#2-시스템-구조)
   - [2.1 모노레포 구성](#21-모노레포-구성)
   - [2.2 아키텍처 다이어그램](#22-아키텍처-다이어그램)
3. [주요 흐름](#3-주요-흐름)
   - [3.1 시세 수집 (배치)](#31-시세-수집-배치)
   - [3.2 백테스트·전략 자동 탐색](#32-백테스트전략-자동-탐색)
   - [3.3 라이브 자동 매매](#33-라이브-자동-매매)
4. [빠른 시작](#4-빠른-시작)
   - [4.1 사전 요구사항](#41-사전-요구사항)
   - [4.2 설치 + 인프라 실행](#42-설치--인프라-실행)
   - [4.3 앱 실행](#43-앱-실행)
   - [4.4 Deployment (단일 VPS)](#44-deployment-단일-vps)
5. [디렉토리 구조](#5-디렉토리-구조)
6. [주요 기능](#6-주요-기능)
7. [기술 스택](#7-기술-스택)
8. [라이선스](#8-라이선스)

---

## 1. 개요

규칙 기반 매매를 백테스트하고, 검증된 룰을 한국투자증권(KIS) 모의·실전
계좌 위에서 자동으로 돌리기 위한 개인용 퀀트 플랫폼입니다.

세 가지 작업을 하나의 환경에서 수행합니다.

- **백테스트** — 미국·국내 OHLCV 10년치를 적재해두고, 룰 (RSI / SMA / 거래량
  배수 등) 기반 누적 수익률·MDD·CAGR 을 즉시 시뮬레이션합니다.
- **전략 자동 탐색** — Grid search 로 학습 7년 / 검증 3년 모두에서 시장 초과
  수익을 낸 룰을 추천합니다 (과적합 1차 필터).
- **라이브 자동 매매** — 활성화한 룰이 cron 스케줄에 맞춰 KIS API 로 매도·매수
  주문을 발송합니다. (`apps/engine/scripts/run-live.sh`, [상세](./apps/engine/README.md#6-라이브-자동매매))

데이터 소스는 미국은 `yfinance`, 한국은 `FinanceDataReader` 를 사용하고,
모든 시계열은 TimescaleDB 에 저장합니다.

## 2. 시스템 구조

### 2.1 모노레포 구성

세 개의 앱과 인프라 설정을 단일 레포에서 관리합니다. 프론트엔드는
Turborepo 로 묶고, 전체 서비스(Go·Python·DB) 오케스트레이션은
Docker Compose 가 담당합니다.

| 컴포넌트     | 위치             | 역할                                                | 자세히                              |
| ------------ | ---------------- | --------------------------------------------------- | ----------------------------------- |
| **Frontend** | `apps/web`       | 사용자 UI (전략 빌더·라이브 모니터링·차트 뷰어)     | [README](./apps/web/README.md)      |
| **API**      | `apps/server`    | 게이트웨이 — 엔진 프록시 + 일부 read 경로 직접 조회 | [README](./apps/server/README.md)   |
| **Engine**   | `apps/engine`    | 시세 수집·백테스트·전략 탐색·라이브 매매 (전부)     | [README](./apps/engine/README.md)   |
| **DB**       | `infra/postgres` | TimescaleDB (PostgreSQL 14 + 시계열 익스텐션)       | `docker-compose.yml` 의 `db` 서비스 |
| **Scripts**  | `scripts/`       | 운영 스크립트 — `ingest-universe.sh`, `run-live.sh` | bulk 적재·라이브 매매 트리거        |

### 2.2 아키텍처 다이어그램

![Architecture](./docs/images/excalidraw/architecture.excalidraw.png)

세 가지 호출 패턴:

- **사용자 요청** — Browser → Next.js → Go API → Python Engine. Go 는 거의 모든
  경로를 그대로 프록시합니다 (예외: 종목 검색·종목 리스트 등 read-heavy 경로는
  DB 직조회).
- **시세 수집** — Engine 이 `yfinance` (미국) / `FinanceDataReader` (한국) 로
  OHLCV 를 받아 TimescaleDB 에 적재. 트리거는 `scripts/ingest-universe.sh`.
- **라이브 매매** — Engine 이 KIS API 로 주문·잔고를 호출. 트리거는
  `scripts/run-live.sh` (cron 또는 수동).

## 3. 주요 흐름

### 3.1 시세 수집 (배치)

`scripts/ingest-universe.sh` 가 `engine` 컨테이너 안의 bulk 적재 스크립트를
실행합니다. 미국·한국을 자동 분기하고, 적재 직후 팩터까지 계산합니다.
유니버스 범위·옵션은 [엔진 README §5](./apps/engine/README.md#5-시세-수집-universe-ingestion).

![Ingest Flow](./docs/images/excalidraw/flow-ingest.excalidraw.png)

### 3.2 백테스트·전략 자동 탐색

전략 페이지 (`/portfolio`) 에서 매매 룰을 작성하면, 두 종류의 작업이
가능합니다.

- **시뮬레이션 (동기)** — 룰을 즉시 백테스트해 누적 수익률·MDD·CAGR·승률
  반환. 한 번의 요청으로 끝나는 빠른 경로.
- **자동 탐색 (비동기)** — 수백~수천 개 룰 조합을 grid search 로 평가하므로
  `job_id` 반환 후 폴링. 학습 7년 / 검증 3년 모두 시장 초과한 룰 상위 N 개를
  최종 결과로 받습니다.

![Backtest & Discover Flow](./docs/images/excalidraw/flow-backtest-discover.excalidraw.png)

> Job 결과는 메모리에 30분간 보존됩니다. 그 안에 다른 페이지로 이동했다
> 돌아오면 같은 `job_id` 로 다시 조회 가능합니다.

### 3.3 라이브 자동 매매

전략 페이지에서 활성화한 룰 1개가, cron 이 호출하는 1회 실행 워커
(`scripts/run-live.sh`) 의 입력이 됩니다. 워커는 매도 → 스크리닝 → 매수
한 라운드를 돌고 종료하며, 상태는 `live_trades` 테이블로 영속화됩니다.

![Live Trade Flow](./docs/images/excalidraw/flow-live.excalidraw.png)

상세 동작 (KIS rate limit, 동시호가 시간대, 활성 전략 변경 영향, 실전 전환
가이드 등) 은 [엔진 README §6](./apps/engine/README.md#6-라이브-자동매매) 참조.

## 4. 빠른 시작

### 4.1 사전 요구사항

| 도구             | 버전          | 필요성                                                                                              |
| ---------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| Docker / Compose | 최신          | 필수 — DB·엔진·서버 컨테이너                                                                        |
| Node.js + pnpm   | v22.18+ / v9+ | 필수 — 프론트엔드                                                                                   |
| Go               | v1.25+        | 선택 — 서버를 도커 없이 로컬 실행할 때만                                                            |
| Python           | v3.11+        | 선택 — 엔진을 도커 없이 로컬 실행할 때만                                                            |
| KIS Open API 키  | -             | **라이브 매매**·모의계좌 사용 시 필수 ([§4.2 KIS](./apps/engine/README.md#42-kis-open-api-키-발급)) |

### 4.2 설치 + 인프라 실행

```bash
# 1. 클론
git clone https://github.com/kim-dongho/quant-platform.git
cd quant-platform

# 2. 모노레포 의존성 (Turborepo)
pnpm install

# 3. 환경변수 — 레포 루트의 .env 에 KIS 모드별 키 채우기
#    (라이브 매매 안 쓰면 비워둬도 동작)
cp .env.example .env  # 없다면 직접 생성
$EDITOR .env

# 4. 인프라 + 백엔드 컨테이너 기동
docker-compose up -d   # db / api / engine 모두 띄움
```

**KIS env (모드별)**: `KIS_PAPER_*` (모의), `KIS_REAL_*` (실전), 각 4개씩
(`APP_KEY` / `APP_SECRET` / `ACCOUNT_NUMBER` / `ACCOUNT_PRODUCT_CODE`)
+ 기본 모드 지정용 `KIS_MODE`. 발급 절차는
[엔진 README §4.2](./apps/engine/README.md#42-kis-open-api-키-발급).

### 4.3 앱 실행 (로컬 개발)

프론트엔드만 로컬 hot-reload, 나머지는 도커가 가장 편한 조합입니다.

```bash
# Terminal 1: 프론트엔드 (Hot-Reload)
cd apps/web && pnpm dev          # http://localhost:3000

# Terminal 2: 첫 데이터 적재 (한 번만, 30~60분)
./scripts/ingest-universe.sh     # 미국 R3000 + 국내 KRX350 OHLCV 10년치
```

접속:

- 프론트엔드 — http://localhost:3000
- Go API Swagger — http://localhost:8080/swagger/index.html
- 엔진 FastAPI Swagger — http://localhost:8000/docs
- DB 직접 접속 — `psql postgresql://user:password@localhost:5432/quant`

전체 도커로만 띄우고 싶으면 (프론트 hot-reload 포기) `docker-compose.yml`
의 `web` 서비스 주석을 풀고 `docker-compose up --build`.

### 4.4 Deployment (단일 VPS)

라이브 매매를 24/7 돌리려면 **로컬 머신이 아니라 VPS** 에서 cron 이 돌아야
합니다. 별도 인프라 추가 없이 같은 `docker-compose.yml` 을 그대로 사용해
배포할 수 있습니다.

```bash
# 0. VPS 에 Docker / git / pnpm 설치
# 1. 레포 클론 + .env 작성 — 로컬과 동일 (KIS 키만 채우면 됨)
git clone https://github.com/kim-dongho/quant-platform.git ~/quant
cd ~/quant && $EDITOR .env

# 2. 컨테이너 + 프론트 빌드 (web 서비스 주석 풀고)
docker-compose up -d --build

# 3. 첫 데이터 적재 (한 번만)
./scripts/ingest-universe.sh

# 4. 라이브 매매 cron 등록 — 평일 15:20 KST
#    paper / real 활성 전략 모두 한 번에 처리 (run-live.sh 가 --mode all 사용)
crontab -e
# 다음 한 줄 추가:
# 20 15 * * 1-5  cd /home/$USER/quant && ./scripts/run-live.sh > /dev/null 2>&1

# 5. 일일 시세 적재 cron 등록 — 평일 17:00 KST (장 마감 후)
# 0 17 * * 1-5  cd /home/$USER/quant && ./scripts/ingest-universe.sh > /dev/null 2>&1

# 6. 분기 재무제표 (DART) 첫 백필 — 한 번만
./scripts/ingest-fundamental.sh --sync-codes --universe kospi200 --years 2020 2021 2022 2023 2024 2025

# 7. 매월 분기보고서 갱신 cron — 매월 15일 03시 (Q1 5/15, Q2 8/15, Q3 11/15 ~)
# 0 3 15 * *  cd /home/$USER/quant && ./scripts/ingest-fundamental.sh \
#   --universe kospi200 --years 2020 2021 2022 2023 2024 2025 \
#   --missing-only --refresh-latest > /dev/null 2>&1
```

**Reverse proxy & 도메인** — 외부에서 브라우저로 접속하려면 nginx 또는 Caddy
로 80/443 → :3000(web), :8080(API) 프록시 필요. Caddy 가 자동 SSL 까지 처리해
가장 간단합니다.

```caddy
# 예: /etc/caddy/Caddyfile
quant.example.com {
    reverse_proxy localhost:3000
}
api.quant.example.com {
    reverse_proxy localhost:8080
}
```

**보안 체크리스트**

- `.env` 는 절대 커밋 금지 (`.gitignore` 확인). VPS 에서도 권한 600 으로.
- 엔진 :8000 / DB :5432 는 외부 노출 X — 방화벽 또는 docker-compose 의
  `ports` 제거. (브라우저는 어차피 Go API 만 거치니 :8080 만 열면 됨)
- KIS `KIS_MODE=real` 전환 전, 반드시 `--dry-run` 으로 검증.

**모니터링** — `scripts/logs/live-*.log`, `scripts/logs/ingest-*.log` 에
자동 기록되니 `tail -f` 또는 `logrotate` 정도로 충분.

## 5. 디렉토리 구조

```
quant-platform/
├── apps/
│   ├── web/                  # Next.js 프론트엔드 (FSD)              → README
│   ├── server/               # Go Fiber API 게이트웨이                → README
│   └── engine/               # Python FastAPI 퀀트 엔진               → README
├── infra/
│   └── postgres/data/        # TimescaleDB 영속 볼륨 (gitignore)
├── scripts/
│   ├── ingest-universe.sh    # bulk OHLCV 적재 (engine 컨테이너 호출)
│   ├── run-live.sh           # 라이브 매매 1회 실행 (cron 트리거)
│   └── logs/                 # 스크립트 실행 로그 (gitignore)
├── docs/images/
│   ├── excalidraw/           # 아키텍처·시퀀스 다이어그램 (Excalidraw PNG)
│   └── screenshots/          # UI 스크린샷
├── docker-compose.yml        # 전체 서비스 오케스트레이션
├── turbo.json                # Turborepo 빌드 캐시 설정
├── pnpm-workspace.yaml       # pnpm 워크스페이스 (apps/*)
├── .env                      # KIS 키 등 (gitignore)
├── .env.example              # .env 템플릿
└── .husky/ .lintstagedrc.json / commitlint.config.js
                              # 커밋 hook — gitleaks·lint·메시지 컨벤션
```

각 앱의 내부 구조는 자체 README 에 정리되어 있습니다.

| 앱            | 구조 가이드                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web`    | [FSD 레이어 (app/views/widgets/features/entities/shared)](./apps/web/README.md#3-디렉토리-구조-fsd) |
| `apps/server` | [도메인별 api 패키지 + proxy 헬퍼](./apps/server/README.md#2-디렉토리-구조)                         |
| `apps/engine` | [api/service/scripts/core 분리](./apps/engine/README.md#3-디렉토리-구조)                            |

## 6. 주요 기능

**📊 차트 & 검색** — `/backtest`

- 종목 자동완성 검색 (symbol·한글/영문 회사명, 완전일치/접두사/부분일치 우선순위)
- 일봉 OHLCV 차트 (TradingView Lightweight Charts)
- URL 쿼리 동기화 (`?symbol=...` — 새로고침·공유에도 상태 보존)
- DB 에 없는 종목은 yfinance / FinanceDataReader 로 **즉시 적재 (lazy ingest)**

**🛠 전략 빌더 & 시뮬레이션** — `/portfolio`

- 카드 기반 룰 작성 (`factor + op + value` 단위)
- 진입 팩터 10종 — RSI, SMA(20/50/200), 가격/SMA 비율, 거래량 배수, 5일 수익률 등
- 청산 정책 4종 — `stop_loss` · `take_profit` · `trailing_stop` · `time_exit`
- **전략 템플릿** — 미리 만들어둔 스타일을 한 번에 불러오기
- 시뮬레이션 한 번에 두 가지 결과 — **누적 수익률 차트** + **오늘의 추천 종목**
- 메트릭 — 누적 수익률 / CAGR / MDD / 승률
- 마지막 거래일 기준 가상 보유 종목 바 (실제 운용 시작 시 추천 종목과 일치)

**🔍 전략 자동 탐색 (Grid Search)**

- 사용자가 시도할 팩터 N개 선택 → 각 팩터별 임계값 5단계 × 비교 2종 자동 시도
- 룰 복잡도 1·2-clause (AND) 선택 — 2-clause 는 다른 팩터끼리만 조합
- **학습 7년 / 검증 3년** 양쪽 모두에서 시장 초과한 룰만 추천 (과적합 1차 필터)
- α 평균 내림차순 정렬, 품질 배지 (양호 / 보통 / 약함)
- 비동기 실행 — 시작 즉시 `job_id` 반환 후 진행률 polling
- 결과 카드 → "이 룰 적용" 클릭 한 번에 빌더에 반영

![Strategy Discover](./docs/images/screenshots/strategy-discover.png)

**🤖 라이브 운영** — `/live`

- 현재 활성 전략 카드 (없으면 안내)
- 한투 모의계좌 잔고·평가금·수익률
- 오늘의 후보 종목 (활성 전략 룰로 다시 스크리닝)
- 주문·체결 내역 (KIS API)
- 라이브 활성화 토글 — 활성화 시 기존 전략 자동 비활성화

![Live Overview](./docs/images/screenshots/live-overview.png)

**📈 라이브 자동매매 워커** ([상세](./apps/engine/README.md#6-라이브-자동매매))

- cron 1회 실행 — 매도 → 스크리닝 → 매수 한 라운드 후 종료
- **외부 매매 sync** — 한투 앱에서 직접 매매해도 다음 실행 시 `live_trades` 자동 동기화
- KIS rate limit (`EGW00201`) 자동 재시도
- 시가 갭 필터 (±X% 초과 시 매수 스킵)
- `--dry-run` — 주문 발송 없이 시뮬레이션 (DB 도 건드리지 않음)
- `--json-out` — 결과 JSON 보고서로 저장

**🗂 데이터 & 인프라**

- 미국 + 국내 통합 유니버스 9종 ([상세](./apps/engine/README.md#51-지원-유니버스))
- 미국 `yfinance` / 한국 `FinanceDataReader` 자동 분기
- 증분 적재 (이미 있는 종목은 마지막 날짜 이후만)
- 팩터 자동 precompute (`factors` 테이블)
- TimescaleDB hypertable + partial unique index 로 활성 전략·open trade 1개 제약

## 7. 기술 스택

| 카테고리     | 사용 기술                                                               |
| ------------ | ----------------------------------------------------------------------- |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS v4 · TanStack Query · Zustand    |
| **API**      | Go · Fiber · GORM · Swagger                                             |
| **Engine**   | Python · FastAPI · pandas · yfinance · FinanceDataReader · KIS Open API |
| **Data**     | TimescaleDB (PostgreSQL 14)                                             |
| **Infra**    | Docker Compose                                                          |
| **Monorepo** | pnpm workspace · Turborepo                                              |

## 8. 라이선스

[MIT](./LICENSE) © 2026 kim-dongho

이 프로젝트는 자가호스팅 도구로, **자동 매매에 따른 모든 손익은 사용자 본인의
책임**입니다. 실전(`KIS_MODE=real`) 전환 전에 모의계좌(`paper`) 에서 충분히
검증하시기 바랍니다.
