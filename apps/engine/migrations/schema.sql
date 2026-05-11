CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    name TEXT,
    exchange VARCHAR(20),
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS market_data (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume BIGINT,
    CONSTRAINT market_data_pk PRIMARY KEY (time, symbol),
    CONSTRAINT fk_stocks FOREIGN KEY (symbol) REFERENCES stocks (symbol)
);

CREATE INDEX IF NOT EXISTS ix_symbol_time_desc ON market_data (symbol, time DESC);

-- 일자별 종목별 팩터 스냅샷 (포트폴리오 스크리닝용)
CREATE TABLE IF NOT EXISTS factors (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    rsi_14 DOUBLE PRECISION,
    sma_20 DOUBLE PRECISION,
    sma_50 DOUBLE PRECISION,
    sma_200 DOUBLE PRECISION,
    vol_ratio_20d DOUBLE PRECISION,
    return_5d DOUBLE PRECISION,
    price_vs_sma20 DOUBLE PRECISION,
    price_vs_sma50 DOUBLE PRECISION,
    price_vs_sma200 DOUBLE PRECISION,
    sma20_vs_sma50 DOUBLE PRECISION,
    CONSTRAINT factors_pk PRIMARY KEY (time, symbol),
    CONSTRAINT fk_factors_stocks FOREIGN KEY (symbol) REFERENCES stocks (symbol)
);

-- 기존 DB(이미 factors가 있는 환경)도 누락 컬럼을 자동 보강.
ALTER TABLE factors ADD COLUMN IF NOT EXISTS sma_200 DOUBLE PRECISION;
ALTER TABLE factors ADD COLUMN IF NOT EXISTS price_vs_sma20 DOUBLE PRECISION;
ALTER TABLE factors ADD COLUMN IF NOT EXISTS price_vs_sma200 DOUBLE PRECISION;
ALTER TABLE factors ADD COLUMN IF NOT EXISTS sma20_vs_sma50 DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS ix_factors_symbol_time_desc ON factors (symbol, time DESC);
CREATE INDEX IF NOT EXISTS ix_factors_time_desc ON factors (time DESC);

-- 저장된 포트폴리오 룰셋
CREATE TABLE IF NOT EXISTS portfolio_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 모의/실전 라이브 전략 (활성 1개 제한, 자동 교체 방식)
CREATE TABLE IF NOT EXISTS live_strategies (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL DEFAULT '기본 전략',
    universe          TEXT NOT NULL,
    clauses           JSONB NOT NULL,
    max_positions     INT  NOT NULL DEFAULT 10,
    exit_policy       JSONB,
    is_active         BOOLEAN NOT NULL DEFAULT FALSE,
    mode              TEXT NOT NULL DEFAULT 'paper',
    position_size_krw BIGINT NOT NULL DEFAULT 1000000,
    last_rebalance_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 활성 전략은 mode 당 1개씩만 (paper 1개 + real 1개 동시 운영 가능).
-- 옛 unique index (전체 1개만 허용) 가 있으면 제거하고 mode 기준으로 재생성.
DROP INDEX IF EXISTS ux_live_strategies_active;
CREATE UNIQUE INDEX IF NOT EXISTS ux_live_strategies_active_per_mode
    ON live_strategies (mode) WHERE is_active;

-- 라이브 매매 trade 로그 — time_exit / trailing_stop 평가에 필요한 진입일·peak 보관
CREATE TABLE IF NOT EXISTS live_trades (
    id              SERIAL PRIMARY KEY,
    strategy_id     INT  NOT NULL REFERENCES live_strategies (id),
    symbol          VARCHAR(20) NOT NULL,
    name            TEXT,
    qty             INT  NOT NULL,
    entry_date      DATE NOT NULL,
    entry_price     DOUBLE PRECISION NOT NULL,
    peak_price      DOUBLE PRECISION NOT NULL,
    exit_date       DATE,
    exit_price      DOUBLE PRECISION,
    exit_reason     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 한 전략 안에서 같은 심볼은 동시에 1개의 open trade만 (exit_date IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS ux_live_trades_open
    ON live_trades (strategy_id, symbol) WHERE exit_date IS NULL;

CREATE INDEX IF NOT EXISTS ix_live_trades_strategy_open
    ON live_trades (strategy_id) WHERE exit_date IS NULL;

-- DART corp_code ↔ stock symbol 매핑 캐시.
-- DART API 는 8자리 corp_code 키로 동작하지만 우리 DB·yfinance 는 6자리+suffix.
-- 매핑은 거의 고정이라 한 번 받아 캐시하면 되며, 신규 상장 시에만 갱신.
CREATE TABLE IF NOT EXISTS corp_codes (
    symbol      VARCHAR(20) PRIMARY KEY,  -- '005930.KS'
    corp_code   VARCHAR(8)  NOT NULL,     -- '00126380'
    corp_name   TEXT,
    stock_code  VARCHAR(6),               -- '005930' (KRX 6자리)
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_corp_codes_corp_code ON corp_codes (corp_code);

-- 분기 재무제표 — 펀더멘털 factor (PBR, ROE, 부채비율, PER) 계산용.
-- 분기당 1 row, 5년치도 200×20=4000 row 로 가벼움 → 하이퍼테이블 불필요.
CREATE TABLE IF NOT EXISTS fundamental_data (
    symbol            VARCHAR(20) NOT NULL REFERENCES stocks (symbol),
    fiscal_quarter    DATE        NOT NULL,        -- 분기말 (예: 2024-03-31)
    revenue           BIGINT,                       -- 매출액 (원)
    operating_income  BIGINT,                       -- 영업이익
    net_income        BIGINT,                       -- 당기순이익
    total_assets      BIGINT,                       -- 자산총계
    total_equity      BIGINT,                       -- 자본총계
    total_liabilities BIGINT,                       -- 부채총계
    eps_basic         BIGINT,                       -- 보통주 기본 주당이익 (원)
    ingested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (symbol, fiscal_quarter)
);

-- 기존 환경 호환 — 누락 컬럼 자동 보강.
ALTER TABLE fundamental_data ADD COLUMN IF NOT EXISTS eps_basic BIGINT;

CREATE INDEX IF NOT EXISTS ix_fundamental_quarter ON fundamental_data (fiscal_quarter DESC);

-- 일별 펀더멘털 factor 스냅샷 — 점수화·랭킹용.
-- (symbol, time) 별로 가장 최근 fundamental_data 와 그날 close 를 결합해 일별 비율 계산.
CREATE TABLE IF NOT EXISTS fundamental_factors (
    time             DATE NOT NULL,                  -- 거래일
    symbol           VARCHAR(20) NOT NULL REFERENCES stocks (symbol),
    pbr              DOUBLE PRECISION,                -- 시가총액 / 자본총계
    per              DOUBLE PRECISION,                -- 시가총액 / TTM 순이익
    roe              DOUBLE PRECISION,                -- TTM 순이익 / 자본총계 × 100 (%)
    debt_to_equity   DOUBLE PRECISION,                -- 부채총계 / 자본총계 × 100 (%)
    operating_margin DOUBLE PRECISION,                -- TTM 영업이익 / TTM 매출 × 100 (%)
    asset_turnover   DOUBLE PRECISION,                -- TTM 매출 / 자산총계 (배)
    PRIMARY KEY (time, symbol)
);

CREATE INDEX IF NOT EXISTS ix_fundfactors_symbol_time ON fundamental_factors (symbol, time DESC);
CREATE INDEX IF NOT EXISTS ix_fundfactors_time ON fundamental_factors (time DESC);

-- discover (grid search) 실행 이력 — params + result 통째.
-- 1회 실행 = 1 row. 한 row 안에 후보 전략 N개 (result 안 all/top 등) 가 묶여 있음.
-- 컨테이너 재시작 후 이전 결과 복원·이력 비교 용도.
CREATE TABLE IF NOT EXISTS discover_runs (
    id          BIGSERIAL PRIMARY KEY,
    universe    VARCHAR(50) NOT NULL,    -- 빠른 필터 (params 의 universe 와 중복이지만 인덱스 가능)
    params      JSONB NOT NULL,           -- DiscoverRequest 통째
    result      JSONB NOT NULL,           -- discover() 반환값 통째 (all/top/ranges/...)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_discover_runs_created ON discover_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_discover_runs_universe ON discover_runs (universe, created_at DESC);
