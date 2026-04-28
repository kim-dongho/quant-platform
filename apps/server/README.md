# `apps/server` — Go API 게이트웨이

> Go · Fiber · GORM · TimescaleDB · Swagger (swaggo)

## 1. 개요

프론트와 Python 엔진 사이의 **게이트웨이** 역할입니다. 거의 모든 핸들러가
엔진 (`http://engine:8000`) 으로 그대로 프록시되며, 일부만 PostgreSQL 을
직접 조회합니다 (종목 검색·일봉 조회 등 자주 호출되는 read 경로).

비즈니스 로직 (백테스트·라이브 매매·팩터 계산 등) 은 모두 `apps/engine`
에 있습니다. 서버는 인증·CORS·요청 검증·Swagger UI 통합만 담당합니다.

## 2. 디렉토리 구조

```
apps/server/
├── cmd/main.go                 # Fiber 앱 엔트리 + 미들웨어 + Swagger 마운트
├── internal/
│   ├── api/                    # 도메인별 라우트 + 핸들러 (1 도메인 = 1 패키지)
│   │   ├── api.go              # Setup(app) — 모든 도메인 RegisterRoutes 호출
│   │   ├── backtest/           # handler.go + routes.go
│   │   ├── stocks/
│   │   ├── portfolio/
│   │   ├── paper/
│   │   └── live/
│   ├── proxy/proxy.go          # 엔진 프록시 헬퍼 (Get/Post/Delete + timeout)
│   ├── database/db.go          # GORM 연결 (DB_DSN env)
│   └── model/                  # GORM 모델 + DTO
├── docs/                       # swag 자동 생성물 (편집 금지)
└── Makefile
```

핸들러 추가 가이드:

1. 도메인 패키지 안의 `handler.go` 에 함수 추가, swaggo 어노테이션 필수.
2. 같은 패키지 `routes.go` 의 `RegisterRoutes` 에 라우트 등록.
3. 새 도메인이면 `internal/api/api.go` 의 `Setup` 에 `RegisterRoutes` 호출 추가.
4. `make swag` 로 Swagger 문서 재생성.

## 3. 빠른 시작

```bash
# 의존성 + Swagger 문서 생성 + :8080 실행
make run

# 빌드만
make build           # bin/server

# Swagger 재생성 (annotation 변경 후 필수)
make swag

# 테스트
go test ./...
```

엔진(:8000) 과 DB(:5432) 가 떠 있어야 합니다 — 보통 레포 루트에서
`docker-compose up -d db redis engine` 으로 띄워둡니다.

## 4. API 라우트

모든 라우트는 `/api/...` prefix 입니다. 엔드포인트 목록은 엔진과 거의 1:1 이라
[`apps/engine/README.md` §7](../engine/README.md#7-api-라우트) 을 참고하세요.

Swagger UI:

```
http://localhost:8080/swagger/index.html
```

## 5. 컨벤션

- **swaggo 어노테이션 필수** — 모든 핸들러는 `@Summary`, `@Tags`, `@Router`
  등을 갖춰야 합니다. 빠지면 docs 가 누락되고 프론트 자동완성도 깨집니다.
- **엔진 프록시는 `internal/proxy` 헬퍼 사용** — 직접 `fiber.Get/Post` 쓰지
  말고 `proxy.Get(c, url)`, `proxy.Post(c, url)` 등을 사용. 에러 처리·헤더
  세팅이 통일됩니다.
- **DB 직접 조회는 최소화** — 가능하면 엔진 라우트에 위임. DB 쿼리가 필요한
  경우는 `internal/api/stocks/handler.go` 처럼 lazy ingest 트리거·검색 등
  read-heavy 경로로 한정.
