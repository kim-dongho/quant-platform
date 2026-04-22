# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A quant trading platform built as a monorepo with three services:
- **`apps/web`** — Next.js 16 frontend (TypeScript, Tailwind CSS v4)
- **`apps/server`** — Go REST API (Fiber, GORM, PostgreSQL)
- **`apps/engine`** — Python quant engine (FastAPI, Pandas, yfinance)

Infrastructure: PostgreSQL with TimescaleDB for time-series data, Redis for caching/message queue.

---

## Development Commands

### Infrastructure (required first)
```bash
docker-compose up -d db redis   # Start PostgreSQL (TimescaleDB) and Redis
```

### Frontend (`apps/web`)
```bash
pnpm dev          # Dev server at http://localhost:3000
pnpm build        # Production build
pnpm lint         # ESLint
pnpm fix          # ESLint --fix + Prettier format
```

### Go Server (`apps/server`)
```bash
make run          # Generate Swagger docs + run server at :8080
make build        # Build binary to bin/server
make swag         # Regenerate Swagger docs only (swag init)
go test ./...     # Run all tests
go test ./internal/controller/... # Run single package tests
```

The server entry point is `cmd/main.go`. Always run `make swag` after adding/changing Swagger annotations.

### Python Engine (`apps/engine`)
```bash
source venv/bin/activate
python src/main.py              # Start FastAPI server at :8000
```

On startup, the engine automatically ingests daily OHLCV and 1-minute candle data for all tickers in `src/core/config.py:TARGET_TICKERS` (runs in a background thread, does not block the server).

### Monorepo (from root)
```bash
pnpm install      # Install all JS dependencies
pnpm dev          # Run all apps via Turborepo
pnpm build        # Build all apps
pnpm lint         # Lint all apps
pnpm format       # Prettier format all TS/TSX/MD files
```

---

## Architecture

### Data Flow
1. Python engine collects OHLCV data from yfinance → stores in TimescaleDB
2. Go server exposes REST API over the data → served at `/api/...`
3. Next.js frontend queries Go server via TanStack Query, renders charts with Lightweight Charts (TradingView library)

### Go Server Structure (`apps/server`)
```
cmd/main.go                    # Entry point, Fiber app setup + Swagger middleware
internal/
  router/router.go             # All routes registered here
  controller/                  # HTTP handlers (candle, stock, backtest)
  model/                       # GORM models (candle, stock, backtest)
  database/db.go               # DB connection
docs/                          # Auto-generated Swagger docs (do not edit manually)
```

**API routes:**
- `GET /api/stocks/list` — stock list
- `GET /api/stocks/:symbol/history` — daily OHLCV history
- `GET /api/stocks/:symbol/intraday` — 1-minute candle data
- `POST /api/backtest/` — run backtest
- `GET /swagger/*` — Swagger UI

### Next.js Frontend Structure (`apps/web/src`)

Follows **Feature-Sliced Design (FSD)** — import direction is strictly top-down:

```
app/              # Next.js App Router layouts and pages
pages/            # Page-level compositions (home/)
widgets/          # Composite UI blocks (stock-dashboard/)
features/         # User interactions (stock-search, trade-stock, chart-control)
entities/         # Domain objects (stock, order) — api/, model/, ui/, lib/
shared/           # Reusable utilities, UI primitives, API client (lib/, ui/, api/)
```

**Import rule:** layers can only import from layers below them (`widgets` → `features` → `entities` → `shared`). Never import upward.

**Key patterns:**
- URL state managed via `nuqs` (query params sync), logic in `widgets/stock-dashboard/lib/use-url-sync.ts`
- Server state via TanStack Query, queries in `entities/stock/api/stocks-queries.ts`
- Client state via Zustand stores in `model/` directories
- Charts rendered with Lightweight Charts in `entities/stock/ui/stock-chart.tsx`

### Python Engine Structure (`apps/engine/src`)
```
main.py              # FastAPI app + lifespan (background ingestion on startup)
api/routes.py        # REST endpoints
service/ingest.py    # Daily OHLCV ingestion via yfinance
service/ingest_1m.py # 1-minute candle ingestion
core/config.py       # TARGET_TICKERS list
core/database.py     # SQLAlchemy setup + init_db()
migrations/          # DB migration scripts
```

---

## Key Conventions

- **Go:** Swagger annotations required on all controller functions. Run `make swag` to regenerate after changes.
- **TypeScript:** Strict mode enabled. Path alias `@/*` maps to `src/*`.
- **Prettier:** Single quotes, 2-space indent, trailing commas, 100 char print width. Import order is enforced by `@trivago/prettier-plugin-sort-imports` — FSD layer order.
- **Environment:** Server reads `DB_HOST`, `REDIS_ADDR` etc. from env vars (see `docker-compose.yml` for local values).

---

## Commit Message Convention

Format: `<type>(<scope>): <한국어 설명>`

### Type
- `feat` — 새 기능 추가
- `fix` — 버그 수정
- `refactor` — 동작 변경 없는 구조 개선 / 분리
- `style` — 코드 포맷, UI 스타일 변경 (로직 변화 X)
- `docs` — 문서, Swagger 등 주석 업데이트
- `chore` — 빌드/설정/패키지 등 기타 변경

### Scope
변경이 발생한 앱(들)을 명시. 복수인 경우 콤마로 나열.
- `web`, `server`, `engine`
- `common` — 저장소 루트/공통 설정(도커, CI, 모노레포 설정, 루트 문서 등 앱 경계를 넘는 변경)
- 복합 예시: `engine,server`, `engine,server,web`

### Description
- **한국어**로 짧고 명확하게 작성 (무엇을 왜 했는지)
- 소문자로 시작, 마침표 없음
- "~ 추가", "~ 수정", "~ 변경", "~ 제거" 같은 능동형 동사로 끝맺기

### Examples
```
feat(engine,server): 1분봉 데이터 수집 로직 및 API 개발
fix(web): backtest 실행 버튼 눌렀을때만 API 동작하도록 변경
refactor(web): chart-control 내부 컴포넌트 분리
style(web): 볼린저 밴드, 수익률 스타일 변경
docs(server): swagger update
feat(engine, web): 백테스팅 매수, 매도 Signal 추가
```
