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