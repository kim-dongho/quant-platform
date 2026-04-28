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

-- 활성 전략은 동시에 1개만 허용 (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS ux_live_strategies_active
    ON live_strategies ((TRUE)) WHERE is_active;

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
