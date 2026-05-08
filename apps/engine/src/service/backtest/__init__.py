"""백테스트 도메인 — 단일 종목, 포트폴리오, fast(grid용), discover, factor_portfolio."""

from src.service.backtest.discover import (
    DEFAULT_EXIT_POLICY,
    DEFAULT_FACTORS,
    DEFAULT_OPS,
    DEFAULT_PERCENTILES,
    discover,
    discover_single_clause,
)
from src.service.backtest.factor_portfolio import (
    DEFAULT_FACTOR_DIRS,
    compute_composite_scores,
    factor_portfolio_backtest,
)
from src.service.backtest.fast import DataCache, fast_backtest
from src.service.backtest.portfolio import (
    ExitPolicy,
    Position,
    _ensure_benchmark_data,
    _get_benchmark,
    _net_entry_price,
    _net_exit_price,
    run_portfolio_backtest,
)
from src.service.backtest.simple import calculate_strategy

__all__ = [
    "calculate_strategy",
    "run_portfolio_backtest",
    "ExitPolicy",
    "Position",
    "_net_entry_price",
    "_net_exit_price",
    "_get_benchmark",
    "_ensure_benchmark_data",
    "DataCache",
    "fast_backtest",
    "discover",
    "discover_single_clause",
    "DEFAULT_FACTORS",
    "DEFAULT_OPS",
    "DEFAULT_PERCENTILES",
    "DEFAULT_EXIT_POLICY",
    "factor_portfolio_backtest",
    "compute_composite_scores",
    "DEFAULT_FACTOR_DIRS",
]
