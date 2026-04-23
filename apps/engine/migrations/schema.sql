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
    vol_ratio_20d DOUBLE PRECISION,
    return_5d DOUBLE PRECISION,
    price_vs_sma50 DOUBLE PRECISION,
    CONSTRAINT factors_pk PRIMARY KEY (time, symbol),
    CONSTRAINT fk_factors_stocks FOREIGN KEY (symbol) REFERENCES stocks (symbol)
);

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
