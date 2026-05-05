"""라이브 자동매매 도메인 — 활성 전략·trade 로그·executor."""

from src.service.live.executor import run_once
from src.service.live.strategy import (
    activate_strategy,
    delete_strategy,
    get_active_strategy,
    list_strategies,
    stop_active_strategy,
    update_active_size,
    upsert_active_strategy,
)
from src.service.live.trades import (
    get_open_trade_by_symbol,
    get_open_trades,
    get_realized_pnl_summary,
    record_entry,
    record_exit,
    sync_with_holdings,
    update_peak_price,
)

__all__ = [
    "run_once",
    "get_active_strategy",
    "list_strategies",
    "upsert_active_strategy",
    "activate_strategy",
    "delete_strategy",
    "update_active_size",
    "stop_active_strategy",
    "record_entry",
    "record_exit",
    "update_peak_price",
    "get_open_trades",
    "get_open_trade_by_symbol",
    "get_realized_pnl_summary",
    "sync_with_holdings",
]
