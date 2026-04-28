# `apps/web` — 퀀트 트레이딩 플랫폼 프론트엔드

> Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · TanStack Query · Zustand · nuqs

## 1. 개요

플랫폼의 사용자 인터페이스. 데이터·연산은 직접 하지 않고 모두
`apps/server` (Go, `:8080`) 를 거쳐 조회합니다. 라이브차트는 TradingView
Lightweight Charts 를 사용합니다.

## 2. 페이지·라우트

| 경로         | 화면                                                         |
| ------------ | ------------------------------------------------------------ |
| `/backtest`  | 단순 차트 뷰어 — 종목 검색 + 일봉                            |
| `/portfolio` | 전략 빌더 — 룰 작성, 시뮬레이션, grid search 자동 탐색       |
| `/live`      | 라이브 운영 — 활성 전략, 모의계좌 잔고, 후보 종목, 주문 내역 |
| `/trade`     | `/live` 로 redirect (구 경로 호환)                           |
| `/`          | `/backtest` 로 redirect                                      |

## 3. 디렉토리 구조 (FSD)

[Feature-Sliced Design](https://feature-sliced.design/) 을 따릅니다. import 는
**위 → 아래로만** 허용 (`app → views → widgets → features → entities → shared`).

```
src/
├── app/              # Next.js App Router (route 파일은 thin wrapper)
├── views/            # 페이지 합성 — 각 라우트 1개. Next.js Pages Router 와 충돌해 FSD 'pages' 대신 'views' 사용.
├── widgets/          # 페이지 본문 합성 (예: portfolio-workbench, live-overview)
├── features/         # 사용자 동작 단위 (예: stock-search, portfolio-rule-builder, strategy-discover)
├── entities/         # 도메인 객체 (api/, model/, ui/, lib/)
│   ├── stock/
│   ├── portfolio/
│   ├── paper/
│   └── live-strategy/
└── shared/           # 재사용 utils, UI primitives, API client
```

규칙:

- 한 layer 안에서는 sibling 끼리 import 금지 (예: `features/A` → `features/B` ✗).
  공유가 필요하면 `entities` 또는 `shared` 로 끌어내립니다.
- `app/(dashboard)/*/page.tsx` 는 절대 비즈니스 로직을 갖지 않습니다 — `views/`
  의 컴포넌트를 import 만.
- `widgets/` 의 model 폴더에 페이지 상태 훅을 둡니다 (예:
  `widgets/portfolio-workbench/model/use-portfolio-state.ts`).

## 4. 빠른 시작

```bash
# 개발 서버 (http://localhost:3000)
pnpm dev

# 프로덕션 빌드
pnpm build

# 린트
pnpm lint               # ESLint
pnpm fix                # ESLint --fix + Prettier
```

Go API (`:8080`) 가 떠 있어야 데이터가 보입니다. 보통 레포 루트에서
`docker-compose up -d` 후 별도 터미널에서 `pnpm dev`.

## 5. 컨벤션

- **import 순서·정렬**: prettier-plugin-sort-imports 가 `react → next →
thirdparty → @/app → @/views → @/widgets → @/features → @/entities → @/shared
→ relative` 순으로 자동 정렬. 그룹 내 specifier 는 ASCII 알파벳 정렬.
- **type-only import 분리**: ESLint `@typescript-eslint/consistent-type-imports`
  로 강제. `import type { X } from '...'` 형태로.
- **상태 관리 분담**:
  - **TanStack Query** — 서버 상태 (`entities/*/api/*-queries.ts` 에 정의)
  - **Zustand** — 클라이언트 전역 상태 (예: `views/stock-dashboard/model/dashboard-store.ts`)
  - **nuqs** — URL 쿼리 파라미터 동기화 (예: 차트 뷰어의 `?symbol=...`)
- **클라이언트/서버 컴포넌트**: nuqs 의 `useSearchParams` 가 필요한 페이지는
  Next.js 16 prerender 를 위해 `Suspense` 경계가 필수입니다 (예: `/backtest`).
