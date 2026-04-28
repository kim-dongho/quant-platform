"""
포트폴리오 백테스터 (포지션 장부 기반).

주요 특징
- 매일 장 마감 기준 평가.
- 보유 슬롯(max_positions)이 비어 있을 때만 조건을 통과한 신규 후보 진입 → 불필요한 교체 매매 최소화.
- Exit policy: stop_loss / take_profit / trailing_stop / time_exit / signal_exit(팩터 기반) OR 결합.
- 수수료·거래세·슬리피지를 반영한 체결가(net price)로 P&L 계산.
- 메트릭: CAGR, MDD, Sharpe + 승률, 평균 보유일, Profit Factor, 거래수 + trade_log.

단순화된 가정
- 체결가 = 당일 종가 (next-bar open 기반 체결은 TODO).
- partial fill 없음, 주문은 즉시 전량 체결.
- 배당/분할/상폐 등 corporate action 무시 (DB에 반영된 adjusted close 가정).
- 현금은 이자 없이 보관.
"""

import math
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sqlalchemy import text


def _safe_float(v, default: float = 0.0) -> float:
    """NaN / ±inf 를 default 로 치환해 JSON 직렬화 호환 보장."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    return f if math.isfinite(f) else default

from src.core.database import engine
from src.service.factor import FACTOR_COLUMNS
from src.service.factor import (
    ScreenError,
    _resolve_universe,
    _validate_clauses,
)


# ---------------------------------------------------------------------------
# 수수료 / 거래세 / 슬리피지 (근사치, 실제 체결 환경과 차이 있을 수 있음)
# ---------------------------------------------------------------------------
_COMMISSION_KR_BUY = 0.00015              # 0.015%
_COMMISSION_KR_SELL = 0.00015 + 0.0018    # 수수료 + 거래세 0.18%
_COMMISSION_US = 0.00020                  # 양방향 0.02% 근사
_SLIPPAGE_KR = 0.001                       # 0.1%
_SLIPPAGE_US = 0.0005                      # 0.05%


def _is_krx(symbol: str) -> bool:
    return symbol.endswith(".KS") or symbol.endswith(".KQ")


def _net_entry_price(gross_price: float, symbol: str) -> float:
    """매수 시 실제 지불 단가 (슬리피지·수수료 반영, gross_price 대비 더 비쌈)."""
    if _is_krx(symbol):
        slip, comm = _SLIPPAGE_KR, _COMMISSION_KR_BUY
    else:
        slip, comm = _SLIPPAGE_US, _COMMISSION_US
    return gross_price * (1 + slip) * (1 + comm)


def _net_exit_price(gross_price: float, symbol: str) -> float:
    """매도 시 실제 수령 단가 (슬리피지·수수료·거래세 반영, gross_price 대비 더 쌈)."""
    if _is_krx(symbol):
        slip, comm = _SLIPPAGE_KR, _COMMISSION_KR_SELL
    else:
        slip, comm = _SLIPPAGE_US, _COMMISSION_US
    return gross_price * (1 - slip) * (1 - comm)


# ---------------------------------------------------------------------------
# Exit policy / Position 데이터 구조
# ---------------------------------------------------------------------------
@dataclass
class ExitPolicy:
    """청산 정책 — 각 필드는 독립적이며 OR 결합으로 평가."""

    stop_loss_pct: Optional[float] = None        # 진입가 대비 하락 % (예: -5.0 = -5%)
    take_profit_pct: Optional[float] = None      # 진입가 대비 상승 % (예: 10.0 = +10%)
    trailing_stop_pct: Optional[float] = None    # 최고가 대비 하락 % (예: -8.0)
    time_exit_days: Optional[int] = None         # 보유 달력일 상한
    signal_exit_clauses: List[Dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> "ExitPolicy":
        if not data:
            return cls()
        return cls(
            stop_loss_pct=data.get("stop_loss_pct"),
            take_profit_pct=data.get("take_profit_pct"),
            trailing_stop_pct=data.get("trailing_stop_pct"),
            time_exit_days=data.get("time_exit_days"),
            signal_exit_clauses=data.get("signal_exit_clauses") or [],
        )


@dataclass
class Position:
    symbol: str
    entry_date: pd.Timestamp
    entry_idx: int               # trading_days 내 인덱스 — 거래일 경과 계산용
    entry_price: float           # gross (체결 시장가 — 수수료·슬리피지 미반영)
    qty: float
    high_since_entry: float      # trailing용


# ---------------------------------------------------------------------------
# 벤치마크 매핑
# ---------------------------------------------------------------------------
# universe별 대표 ETF 벤치마크 — (symbol, 표시용 label) 쌍.
# 미국은 해당 지수 추종 주요 ETF, 국내는 KODEX 시리즈.
_BENCHMARKS: Dict[str, tuple[str, str]] = {
    "watchlist": ("SPY", "S&P 500"),                 # 테마형, 대체로 미국 중심
    "sp500": ("SPY", "S&P 500"),
    "nasdaq100": ("QQQ", "NASDAQ 100"),
    "russell1000": ("IWB", "Russell 1000"),
    "russell2000": ("IWM", "Russell 2000"),
    "russell3000": ("IWV", "Russell 3000"),
    "kospi200": ("069500.KS", "KOSPI 200"),
    "kosdaq150": ("229200.KQ", "KOSDAQ 150"),
    "krx350": ("292050.KS", "KRX 300"),              # KOSPI+KOSDAQ 대형주 근사
}


def _get_benchmark(universe: str) -> tuple[str, str]:
    return _BENCHMARKS.get(universe, ("SPY", "S&P 500"))


def _ensure_benchmark_data(symbol: str) -> bool:
    with engine.connect() as conn:
        count = conn.execute(
            text("SELECT COUNT(*) FROM market_data WHERE symbol = :s"),
            {"s": symbol},
        ).scalar()
    if count and int(count) > 0:
        return True
    print(f"📥 Benchmark {symbol} missing — lazy ingesting before backtest...")
    try:
        from src.service.ingest import save_to_db
        save_to_db(symbol)
        return True
    except Exception as e:
        print(f"⚠️ Benchmark ingestion failed: {e}")
        return False


# ---------------------------------------------------------------------------
# 데이터 로더 (기존 유지)
# ---------------------------------------------------------------------------
def _load_factors(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    placeholders = ", ".join([f":s{i}" for i in range(len(symbols))])
    params: Dict[str, Any] = {"start": start, "end": end}
    for i, s in enumerate(symbols):
        params[f"s{i}"] = s

    query = text(
        f"""
        SELECT date, symbol, {", ".join(FACTOR_COLUMNS)} FROM (
            SELECT DISTINCT ON (time::date, symbol)
                time::date AS date, symbol, {", ".join(FACTOR_COLUMNS)}, time
            FROM factors
            WHERE symbol IN ({placeholders})
              AND time::date BETWEEN :start AND :end
            ORDER BY time::date ASC, symbol ASC, time DESC
        ) t
        ORDER BY date ASC, symbol ASC
        """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params=params)
    return df


def _load_closes(symbols: List[str], start: str, end: str) -> pd.DataFrame:
    placeholders = ", ".join([f":s{i}" for i in range(len(symbols))])
    params: Dict[str, Any] = {"start": start, "end": end}
    for i, s in enumerate(symbols):
        params[f"s{i}"] = s

    query = text(
        f"""
        SELECT date, symbol, close FROM (
            SELECT DISTINCT ON (time::date, symbol)
                time::date AS date, symbol, close, time
            FROM market_data
            WHERE symbol IN ({placeholders})
              AND time::date BETWEEN :start AND :end
            ORDER BY time::date ASC, symbol ASC, time DESC
        ) t
        ORDER BY date ASC
        """
    )
    with engine.connect() as conn:
        long_df = pd.read_sql(query, conn, params=params)
    if long_df.empty:
        return pd.DataFrame()
    return long_df.pivot(index="date", columns="symbol", values="close")


# ---------------------------------------------------------------------------
# 조건 평가
# ---------------------------------------------------------------------------
def _apply_clauses(df: pd.DataFrame, clauses: List[Dict[str, Any]]) -> pd.DataFrame:
    """DataFrame (종목 × 팩터) 에 AND 결합 조건 적용해 필터링."""
    mask = pd.Series(True, index=df.index)
    for c in clauses:
        col = c["factor"]
        op = c["op"]
        val = c["value"]
        if col not in df.columns:
            continue
        s = df[col]
        if op == "<": mask &= s < val
        elif op == "<=": mask &= s <= val
        elif op == ">": mask &= s > val
        elif op == ">=": mask &= s >= val
        elif op == "=": mask &= s == val
        elif op == "!=": mask &= s != val
    return df[mask]


def _eval_clauses_or(factor_row: pd.Series, clauses: List[Dict[str, Any]]) -> bool:
    """단일 행에 OR 결합으로 조건 평가 — signal exit 용 (하나라도 맞으면 청산)."""
    for c in clauses:
        col, op, val = c["factor"], c["op"], c["value"]
        if col not in factor_row.index:
            continue
        x = factor_row[col]
        if pd.isnull(x):
            continue
        if op == "<" and x < val: return True
        if op == "<=" and x <= val: return True
        if op == ">" and x > val: return True
        if op == ">=" and x >= val: return True
        if op == "=" and x == val: return True
        if op == "!=" and x != val: return True
    return False


def _should_exit(
    pos: Position,
    today_idx: int,
    today_price: float,
    today_factor_row: Optional[pd.Series],
    policy: ExitPolicy,
) -> Optional[str]:
    """청산 사유 반환. 해당 사항 없으면 None.
    time_exit_days 는 거래일(trading_days 인덱스) 기준으로 카운트.
    """
    if pos.entry_price <= 0:
        return None
    ret_pct = (today_price / pos.entry_price - 1) * 100

    if policy.stop_loss_pct is not None and ret_pct <= policy.stop_loss_pct:
        return "stop_loss"
    if policy.take_profit_pct is not None and ret_pct >= policy.take_profit_pct:
        return "take_profit"
    if policy.trailing_stop_pct is not None and pos.high_since_entry > 0:
        from_high_pct = (today_price / pos.high_since_entry - 1) * 100
        if from_high_pct <= policy.trailing_stop_pct:
            return "trailing_stop"
    if policy.time_exit_days is not None:
        held_trading_days = today_idx - pos.entry_idx
        if held_trading_days >= policy.time_exit_days:
            return "time_exit"
    if policy.signal_exit_clauses and today_factor_row is not None:
        if _eval_clauses_or(today_factor_row, policy.signal_exit_clauses):
            return "signal_exit"
    return None


# ---------------------------------------------------------------------------
# 메트릭
# ---------------------------------------------------------------------------
def _compute_equity_metrics(equity: pd.Series) -> Dict[str, float]:
    """CAGR / MDD / Sharpe (일간 수익률 기준, rf=0). 모든 값은 _safe_float 로 정규화."""
    if len(equity) < 2:
        return {"cagr": 0.0, "mdd": 0.0, "sharpe": 0.0}

    start_val = _safe_float(equity.iloc[0])
    end_val = _safe_float(equity.iloc[-1])
    days = (equity.index[-1] - equity.index[0]).days
    years = max(days / 365.25, 1e-9)

    # end_val 이 0 이하면 음수 거듭제곱을 피해 -1.0 (전손) 반환
    if start_val > 0 and end_val > 0:
        cagr = (end_val / start_val) ** (1 / years) - 1
    elif end_val <= 0:
        cagr = -1.0
    else:
        cagr = 0.0

    rolling_max = equity.cummax()
    drawdown = (equity / rolling_max - 1).replace([np.inf, -np.inf], np.nan).dropna()
    mdd = _safe_float(drawdown.min()) if len(drawdown) > 0 else 0.0

    daily_returns = equity.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    std = _safe_float(daily_returns.std())
    mean = _safe_float(daily_returns.mean())
    sharpe = mean / std * np.sqrt(252) if std > 0 else 0.0

    return {
        "cagr": _safe_float(cagr),
        "mdd": _safe_float(mdd),
        "sharpe": _safe_float(sharpe),
    }


def _compute_trade_metrics(trade_log: List[Dict[str, Any]]) -> Dict[str, float]:
    """승률 / 평균 보유일 / Profit Factor / 거래수 (종료된 체결 기준)."""
    n = len(trade_log)
    if n == 0:
        return {
            "num_trades": 0,
            "win_rate": 0.0,
            "avg_hold_days": 0.0,
            "profit_factor": 0.0,
        }
    wins = [t for t in trade_log if t["return_pct"] > 0]
    losses = [t for t in trade_log if t["return_pct"] <= 0]

    total_win = sum(t["return_pct"] for t in wins)
    total_loss = -sum(t["return_pct"] for t in losses)  # 양수화
    if total_loss > 0:
        pf = total_win / total_loss
    else:
        pf = 999.0 if total_win > 0 else 0.0  # 손실 0이면 이론상 무한, 상한 999

    return {
        "num_trades": n,
        "win_rate": _safe_float(len(wins) / n),
        "avg_hold_days": _safe_float(sum(t["hold_days"] for t in trade_log) / n),
        "profit_factor": _safe_float(pf),
    }


# ---------------------------------------------------------------------------
# 메인 함수
# ---------------------------------------------------------------------------
_INITIAL_CAPITAL = 1.0  # 정규화된 시작 자본 (equity 1.0 기준)


def run_portfolio_backtest(
    universe: str,
    clauses: List[Dict[str, Any]],
    max_positions: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exit_policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    포지션 장부 기반 백테스트.

    매일:
      1) 보유 종목 high_since_entry 업데이트 + exit 조건 평가 → 청산
      2) 빈 슬롯만큼 조건 통과한 신규 후보 진입 (이미 보유 종목은 제외)
      3) 총자산(cash + 포지션가치) 기록

    수수료·거래세·슬리피지는 진입·청산 시 net_entry/exit_price로 반영.
    """
    _validate_clauses(clauses)
    symbols = _resolve_universe(universe)
    if not symbols:
        raise ScreenError("Universe is empty")

    policy = ExitPolicy.from_dict(exit_policy)

    benchmark_symbol, benchmark_label = _get_benchmark(universe)
    _ensure_benchmark_data(benchmark_symbol)

    end = end_date or date.today().isoformat()
    if start_date:
        start = start_date
    else:
        start = (
            datetime.fromisoformat(end).date().replace(
                year=datetime.fromisoformat(end).year - 3
            )
        ).isoformat()

    factors_df = _load_factors(symbols, start, end)
    closes = _load_closes(symbols + [benchmark_symbol], start, end)

    # 일부 종목의 최신 일자가 DB에 아직 반영 안 된 경우 (장중·미수집) equity 계산이
    # 왜곡되므로 종목별로 직전 거래일 가격을 forward-fill 한다.
    if not closes.empty:
        closes = closes.sort_index().ffill()

    if factors_df.empty or closes.empty:
        return _empty_result(
            "insufficient data — factors 또는 market_data가 비어있습니다. "
            "유니버스 종목의 ingest를 먼저 실행하세요.",
            start,
            end,
        )

    # DB에서 온 date 컬럼은 datetime.date 타입이라 pd.Timestamp로 일원화해야
    # .date() 호출 및 Timestamp 산술이 일관됨.
    factor_dates = pd.DatetimeIndex(pd.to_datetime(factors_df["date"].unique())).sort_values()
    closes.index = pd.DatetimeIndex(pd.to_datetime(closes.index))
    factors_df = factors_df.assign(date=pd.to_datetime(factors_df["date"]))
    trading_days = factor_dates.intersection(closes.index)

    if len(trading_days) < 2:
        return _empty_result("trading_days < 2", start, end)

    # --- 메인 루프 ---
    cash = _INITIAL_CAPITAL
    positions: Dict[str, Position] = {}
    equity_rows: List[Dict[str, Any]] = []
    trade_log: List[Dict[str, Any]] = []

    for today_idx, day in enumerate(trading_days):
        day_factors = factors_df[factors_df["date"] == day].set_index("symbol")

        # 1) Exit 평가
        for sym in list(positions.keys()):
            pos = positions[sym]
            if sym not in closes.columns:
                continue
            raw_px = closes.loc[day, sym]
            if pd.isnull(raw_px):
                continue
            px = float(raw_px)

            # trailing 용 high 업데이트
            if px > pos.high_since_entry:
                pos.high_since_entry = px

            factor_row = day_factors.loc[sym] if sym in day_factors.index else None
            reason = _should_exit(pos, today_idx, px, factor_row, policy)
            if reason is None:
                continue

            # 청산 — net price로 현금 회수
            net_px = _net_exit_price(px, sym)
            cash += pos.qty * net_px

            entry_net = _net_entry_price(pos.entry_price, sym)
            ret_pct = (net_px / entry_net - 1) * 100 if entry_net > 0 else 0.0

            trade_log.append({
                "symbol": sym,
                "entry_date": pos.entry_date.date().isoformat(),
                "exit_date": day.date().isoformat(),
                "entry_price": float(pos.entry_price),
                "exit_price": px,
                "return_pct": float(ret_pct),
                "hold_days": today_idx - pos.entry_idx,  # 거래일 기준
                "exit_reason": reason,
            })
            del positions[sym]

        # 2) 신규 진입 (빈 슬롯만)
        empty_slots = max_positions - len(positions)
        if empty_slots > 0 and not day_factors.empty:
            selected = _apply_clauses(day_factors, clauses)
            picks: List[tuple[str, float]] = []
            for sym in selected.index:
                if sym in positions or sym not in closes.columns:
                    continue
                raw_px = closes.loc[day, sym]
                if pd.isnull(raw_px):
                    continue
                picks.append((sym, float(raw_px)))
                if len(picks) >= empty_slots:
                    break

            if picks and cash > 0:
                per_slot_cash = cash / empty_slots
                for sym, px in picks:
                    net_px = _net_entry_price(px, sym)
                    if net_px <= 0:
                        continue
                    qty = per_slot_cash / net_px
                    if qty <= 0:
                        continue
                    cash -= qty * net_px
                    positions[sym] = Position(
                        symbol=sym,
                        entry_date=day,
                        entry_idx=today_idx,
                        entry_price=px,
                        qty=qty,
                        high_since_entry=px,
                    )

        # 3) 오늘의 총자산 기록
        positions_value = 0.0
        for sym, pos in positions.items():
            if sym in closes.columns:
                raw_px = closes.loc[day, sym]
                if pd.notnull(raw_px):
                    positions_value += pos.qty * float(raw_px)
        equity = cash + positions_value
        equity_rows.append({"time": day.date().isoformat(), "value": _safe_float(equity)})

    # --- 벤치마크 ---
    bench_rows: List[Dict[str, Any]] = []
    if benchmark_symbol in closes.columns:
        bench_series = closes[benchmark_symbol].reindex(trading_days).ffill()
        base = bench_series.iloc[0]
        if base and base > 0:
            bench_rows = [
                {"time": d.date().isoformat(), "value": _safe_float(v / base)}
                for d, v in bench_series.items()
                if pd.notnull(v)
            ]

    # --- 메트릭 ---
    equity_series = pd.Series(
        [r["value"] for r in equity_rows],
        index=pd.to_datetime([r["time"] for r in equity_rows]),
    )
    metrics = {
        **_compute_equity_metrics(equity_series),
        **_compute_trade_metrics(trade_log),
    }

    # final_positions 에 회사명 포함시켜 반환 (프론트 표시용)
    final_symbols = list(positions.keys())
    name_map: Dict[str, str] = {}
    if final_symbols:
        sym_placeholders = ", ".join([f":s{i}" for i in range(len(final_symbols))])
        sym_params = {f"s{i}": s for i, s in enumerate(final_symbols)}
        with engine.connect() as conn:
            rows = conn.execute(
                text(f"SELECT symbol, name FROM stocks WHERE symbol IN ({sym_placeholders})"),
                sym_params,
            ).mappings().all()
        for r in rows:
            name_map[r["symbol"]] = r["name"]

    return {
        "dates": [r["time"] for r in equity_rows],
        "equity": equity_rows,
        "benchmark": bench_rows,
        "benchmark_symbol": benchmark_symbol,
        "benchmark_label": benchmark_label,
        "metrics": metrics,
        "final_positions": [
            {"symbol": s, "name": name_map.get(s, s)} for s in final_symbols
        ],
        "trades": trade_log,
        "start_date": start,
        "end_date": end,
    }


def _empty_result(note: str, start: str, end: str) -> Dict[str, Any]:
    return {
        "dates": [],
        "equity": [],
        "benchmark": [],
        "metrics": {
            "cagr": 0.0,
            "mdd": 0.0,
            "sharpe": 0.0,
            "num_trades": 0,
            "win_rate": 0.0,
            "avg_hold_days": 0.0,
            "profit_factor": 0.0,
        },
        "final_positions": [],
        "trades": [],
        "note": note,
        "start_date": start,
        "end_date": end,
    }
