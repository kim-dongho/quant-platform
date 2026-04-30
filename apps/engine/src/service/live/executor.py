"""
라이브 자동매매 실행기.

흐름 (cron이 KST 15:20에 1회 호출):
  1. 활성 전략 로드 (live_strategies)
  2. KIS 잔고 조회 (보유 종목 + 현금)
  3. 보유 종목에 exit_policy 적용 → 매도 주문 (시장가 = 동시호가 종가 체결)
  4. screen으로 진입 후보 추출 → 시가 갭 필터링 → 빈 슬롯만큼 매수 주문
  5. last_rebalance_at 갱신

⚠️ 시그널 데이터: 어제 종가까지의 factor (오늘 종가는 아직 미확정).
   백테스트와의 일관성을 위해 daily quant 표준 방식(close-on-close)을 따름.
"""
from __future__ import annotations

import time
from typing import Any, Optional

from sqlalchemy import text

from datetime import date

from src.core.database import engine
from src.service.kis import KisClient, KisError, get_kis_client
from src.service.live.hysteresis import evaluate_signal_exit
from src.service.live.strategy import get_active_strategy
from src.service.live.trades import record_entry, record_exit, sync_with_holdings
from src.service.backtest import ExitPolicy
from src.service.factor import run_screen

# 시가 갭이 이 이상이면 진입 스킵 (양방향).
# 어제 종가 시그널 ↔ 실제 진입가 괴리를 줄이는 가장 효과적인 필터.
GAP_FILTER_PCT = 5.0

# KIS 모의계좌 초당 거래건수 제한이 2건이라 호출 사이에 짧은 sleep 필요.
# 0.5초면 안전하게 초당 2건 이내, 30종목 시가 조회 시 약 15초 추가 소요.
KIS_QUOTE_SLEEP_SEC = 0.5
# Rate limit(EGW00201)에 걸리면 1회 재시도.
KIS_RATE_LIMIT_RETRY_SLEEP_SEC = 1.2


def _get_yesterday_close(symbol: str) -> Optional[float]:
    """market_data에서 종목의 가장 최근(=어제) 종가."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT close FROM market_data WHERE symbol = :s "
                "ORDER BY time DESC LIMIT 1"
            ),
            {"s": symbol},
        ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def _today_gap_pct(symbol: str, kis: KisClient) -> Optional[float]:
    """오늘 시가가 어제 종가 대비 몇 % 인지. 데이터 없으면 None.

    KIS rate limit (EGW00201)에 걸리면 1회 재시도.
    """
    yesterday_close = _get_yesterday_close(symbol)
    if not yesterday_close or yesterday_close <= 0:
        return None

    for attempt in range(2):  # 최초 + 재시도 1회
        try:
            quote = kis.get_current_price(symbol)
            break
        except KisError as e:
            # rate limit 에러면 잠깐 쉬고 재시도, 다른 에러면 즉시 포기
            if "EGW00201" in str(e) and attempt == 0:
                time.sleep(KIS_RATE_LIMIT_RETRY_SLEEP_SEC)
                continue
            return None
    else:
        return None

    open_price = float(quote.get("open") or 0)
    if open_price <= 0:
        return None
    return (open_price / yesterday_close - 1) * 100


def _to_code(symbol: str) -> str:
    """KIS 형식('000150') 과 DB 형식('000150.KS') 비교용 — 6자리 코드만 추출."""
    return symbol.split(".")[0] if symbol else symbol


def _label(symbol: str, name: Optional[str]) -> str:
    """로그·UI용 표시: '종목명 (티커)' 또는 이름 없으면 티커만."""
    if name and name != symbol:
        return f"{name} ({symbol})"
    return symbol


def _place_order_with_retry(kis: KisClient, symbol: str, qty: int, side: str) -> bool:
    """KIS 주문 발송 + rate limit(EGW00201) 시 1회 재시도. 성공 True."""
    for attempt in range(2):
        try:
            kis.place_order(symbol=symbol, qty=qty, side=side, order_type="market")
            return True
        except KisError as e:
            if "EGW00201" in str(e) and attempt == 0:
                time.sleep(KIS_RATE_LIMIT_RETRY_SLEEP_SEC)
                continue
            print(f"   ❌ {side} failed: {e}")
            return False
    return False


def _load_latest_factors(symbols: list[str]) -> dict[str, dict[str, Any]]:
    """보유 종목들의 가장 최근 factor 행을 일괄 조회.

    KIS 잔고 symbol 은 6자리('000150'), DB 는 .KS/.KQ suffix 형식이라 두 가지 모두
    시도. 종목 → factor 행 dict 형태로 반환 (signal_exit 평가용).
    """
    if not symbols:
        return {}
    # 6자리 코드 → DB suffix 형식 후보로 확장 (.KS/.KQ)
    candidates: list[str] = []
    for s in symbols:
        candidates.append(s)
        if "." not in s:
            candidates.extend([f"{s}.KS", f"{s}.KQ"])

    query = text(
        """
        SELECT DISTINCT ON (symbol)
            symbol, rsi_14, sma_20, sma_50, sma_200, vol_ratio_20d, return_5d,
            price_vs_sma20, price_vs_sma50, price_vs_sma200, sma20_vs_sma50
        FROM factors
        WHERE symbol = ANY(:syms)
        ORDER BY symbol, time DESC
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(query, {"syms": candidates}).mappings().all()

    # 6자리 코드 키로 normalize 해서 반환
    result: dict[str, dict[str, Any]] = {}
    for r in rows:
        code = r["symbol"].split(".")[0] if r["symbol"] else r["symbol"]
        result[code] = dict(r)
    return result


def _evaluate_exits(
    holdings: list[dict[str, Any]],
    open_trades: dict[str, dict[str, Any]],
    policy: ExitPolicy,
) -> list[tuple[str, int, str, str, Optional[int]]]:
    """청산할 (symbol, qty, name, reason, trade_id) 리스트.

    평가 우선순위:
      stop_loss → take_profit → trailing_stop → time_exit → signal_exit
    한 종목당 한 reason만. trade_id가 None이면 live_trades 기록이 없어
    time_exit/trailing_stop을 평가 못 한 케이스 (외부 매수분 첫 사이클).
    signal_exit 는 진입 룰 깨짐 (hysteresis) — 백테스트와 일관된 동작.
    """
    to_exit: list[tuple[str, int, str, str, Optional[int]]] = []
    today = date.today()

    # signal_exit 평가용 — 보유 종목 최신 factor 일괄 로드
    signal_clauses = policy.signal_exit_clauses or []
    factors_by_code: dict[str, dict[str, Any]] = {}
    if signal_clauses:
        codes = [str(h.get("symbol", "")).split(".")[0] for h in holdings if h.get("symbol")]
        factors_by_code = _load_latest_factors(codes)

    for h in holdings:
        symbol = h.get("symbol")
        qty = int(h.get("qty") or 0)
        if not symbol or qty <= 0:
            continue
        avg_cost = float(h.get("avg_cost") or 0)
        cur = float(h.get("current_price") or 0)
        if avg_cost <= 0 or cur <= 0:
            continue
        ret_pct = (cur / avg_cost - 1) * 100

        trade = open_trades.get(symbol)
        trade_id = int(trade["id"]) if trade else None
        peak = float(trade["peak_price"]) if trade else cur
        entry_dt = trade["entry_date"] if trade else None
        days_held = (today - entry_dt).days if entry_dt else 0

        reason: Optional[str] = None
        if policy.stop_loss_pct is not None and ret_pct <= policy.stop_loss_pct:
            reason = "stop_loss"
        elif policy.take_profit_pct is not None and ret_pct >= policy.take_profit_pct:
            reason = "take_profit"
        elif policy.trailing_stop_pct is not None and peak > 0:
            trail_pct = (cur / peak - 1) * 100
            if trail_pct <= policy.trailing_stop_pct:
                reason = "trailing_stop"
        elif (
            policy.time_exit_days is not None
            and entry_dt is not None
            and days_held >= policy.time_exit_days
        ):
            reason = "time_exit"
        elif signal_clauses:
            code = str(symbol).split(".")[0]
            factor_row = factors_by_code.get(code)
            if factor_row and evaluate_signal_exit(factor_row, signal_clauses):
                reason = "signal_exit"

        if reason:
            name = h.get("name") or symbol
            to_exit.append((symbol, qty, name, reason, trade_id))
    return to_exit


def run_once(dry_run: bool = False) -> dict[str, Any]:
    """라이브 매매 1회 실행. cron이 호출."""
    print(f"🤖 Live executor start (dry_run={dry_run})")

    strategy = get_active_strategy()
    if not strategy:
        print("⚠️  활성 전략 없음 — 종료")
        return {"status": "no_strategy"}

    print(
        f"📋 Strategy: {strategy['name']} "
        f"(universe={strategy['universe']}, max_positions={strategy['max_positions']})"
    )

    kis = get_kis_client()
    try:
        balance = kis.get_balance()
    except KisError as e:
        print(f"❌ KIS balance failed: {e}")
        return {"status": "kis_error", "error": str(e)}

    holdings: list[dict[str, Any]] = balance.get("holdings") or []
    summary = balance.get("summary") or {}
    # `cash` (dnca_tot_amt) 는 정산 전 총액이라 매수해도 안 줄어듦 — 실제 매수 가능 예수금은
    # D+2 정산금 (prvs_rcdl_excc_amt). 자동 배분·잔고 부족 체크는 이걸 기준으로.
    cash = float(summary.get("deposit_d2") or summary.get("cash") or 0)
    print(f"💰 Holdings: {len(holdings)}개, 매수가능: ₩{cash:,.0f}")

    # ─── 0. live_trades 와 KIS 잔고 sync ─────────────────────
    # 외부 매수/매도 반영 + peak_price 갱신 + 진입일 정보 확보 (time_exit 평가용).
    # dry_run 시에도 sync는 수행해야 평가가 의미 있음 (trade 로그는 진입일을 보존).
    if dry_run:
        # dry-run에선 DB 수정 안 함 — peak/sync 효과만 in-memory로
        from src.service.live.trades import get_open_trades

        open_trades_list = get_open_trades(strategy["id"])
        open_trades = {t["symbol"]: t for t in open_trades_list}
        print(f"📒 Open trades (dry-run, no sync): {len(open_trades)}개")
    else:
        open_trades = sync_with_holdings(strategy["id"], holdings)
        print(f"📒 Open trades (synced): {len(open_trades)}개")

    # ─── 1. Exit 평가 → 매도 ──────────────────────────────────
    policy = ExitPolicy.from_dict(strategy.get("exit_policy"))
    to_exit = _evaluate_exits(holdings, open_trades, policy)

    sells: list[dict[str, Any]] = []
    sold_syms: set[str] = set()
    # 매도 단가 추정용 — 실 체결가는 비동기지만 기록상 현재가 사용
    cur_prices = {h["symbol"]: float(h.get("current_price") or 0) for h in holdings}
    for i, (symbol, qty, name, reason, trade_id) in enumerate(to_exit):
        if i > 0 and not dry_run:
            # KIS 모의 초당 2건 제한 회피 + rate limit 시 1회 retry
            time.sleep(KIS_QUOTE_SLEEP_SEC)
        label = _label(symbol, name)
        print(f"🔻 SELL {label} qty={qty} reason={reason}")
        record = {"symbol": symbol, "name": name, "qty": qty, "reason": reason}
        if dry_run:
            record["dry_run"] = True
            sells.append(record)
            sold_syms.add(symbol)
            continue
        if _place_order_with_retry(kis, symbol, qty, side="sell"):
            sells.append(record)
            sold_syms.add(symbol)
            # trade close — 진입일/peak이 있는 경우만 (외부 매수분이면 trade_id None)
            if trade_id is not None:
                exit_px = cur_prices.get(symbol) or 0.0
                record_exit(trade_id, exit_price=exit_px, reason=reason)

    # ─── 2. 진입 후보 (screen) ───────────────────────────────
    # KIS 잔고 symbol 은 6자리('000150'), 스크리닝 결과는 .KS/.KQ suffix 형식
    # ('000150.KS') 라 .symbol 직접 비교하면 같은 종목을 다른 종목으로 인식해
    # 이미 보유한 종목을 또 매수하는 버그 → 6자리 코드로 정규화 후 비교.
    sold_codes = {_to_code(s) for s in sold_syms}
    held_codes = {_to_code(h["symbol"]) for h in holdings} - sold_codes
    open_slots = strategy["max_positions"] - len(held_codes)

    if open_slots <= 0:
        print(f"📊 빈 슬롯 없음 (보유 {len(held_codes)}/{strategy['max_positions']}) — 매수 스킵")
        return {"status": "ok", "sells": sells, "buys": []}

    print(f"🔍 빈 슬롯 {open_slots}개 — screen 실행")
    # 갭 필터로 일부 후보가 제외될 것을 감안해 max_positions * 3 만큼 후보 요청.
    # screen 자체는 LIMIT으로 잘리므로 buffer 없이 정확히 max_positions만 받으면
    # 갭 스킵된 만큼 슬롯이 빈 채로 남음.
    candidate_buffer = max(strategy["max_positions"] * 3, open_slots * 3)
    try:
        screen_result = run_screen(
            universe=strategy["universe"],
            clauses=strategy["clauses"],
            max_positions=candidate_buffer,
        )
    except Exception as e:
        print(f"❌ screen failed: {e}")
        return {"status": "screen_error", "error": str(e), "sells": sells, "buys": []}

    # 보유 + 방금 매도한 종목 모두 후보 제외 (sell→buy 한 라운드 왕복 방지).
    excluded_codes = held_codes | sold_codes
    raw_candidates = [
        c
        for c in (screen_result.get("candidates") or [])
        if _to_code(c["symbol"]) not in excluded_codes
    ]
    print(f"   → 후보 {len(raw_candidates)}개 (보유 제외, buffer={candidate_buffer})")

    # ─── 3. 시가 갭 필터 ─────────────────────────────────────
    selected: list[tuple[dict[str, Any], float]] = []
    # 빈 슬롯의 3배까지만 KIS 시가 조회 (rate limit 보수적 운용).
    # 호출 사이에 sleep을 두어 모의계좌 초당 2건 제한을 회피.
    for i, c in enumerate(raw_candidates[: open_slots * 3]):
        if i > 0:
            time.sleep(KIS_QUOTE_SLEEP_SEC)
        symbol = c["symbol"]
        label = _label(symbol, c.get("company_name"))
        gap = _today_gap_pct(symbol, kis)
        if gap is None:
            print(f"   ⚠️  {label}: 시가 데이터 없음 → 스킵")
            continue
        if abs(gap) > GAP_FILTER_PCT:
            print(f"   🚫 {label}: 시가 갭 {gap:+.2f}% (>±{GAP_FILTER_PCT}%) → 스킵")
            continue
        selected.append((c, gap))
        if len(selected) >= open_slots:
            break

    # ─── 4. 매수 주문 ────────────────────────────────────────
    # position_size_krw > 0 → 종목당 고정 배분.
    # position_size_krw <= 0 → 자본 균등 분배 (현재 잔고 / 빈 슬롯).
    #   1주도 못 사는 후보가 생기면 다음 후보가 같은 size 로 시도. 잔고 부족분만 스킵.
    fixed_size = int(strategy.get("position_size_krw") or 0)
    equal_weight = fixed_size <= 0
    auto_size = int(cash // max(open_slots, 1)) if equal_weight else 0
    if equal_weight:
        print(f"💸 자본 균등 분배 — 잔고 ₩{cash:,.0f} ÷ 슬롯 {open_slots} = 종목당 ₩{auto_size:,}")

    buys: list[dict[str, Any]] = []
    for i, (c, gap) in enumerate(selected):
        if i > 0 and not dry_run:
            time.sleep(KIS_QUOTE_SLEEP_SEC)
        symbol = c["symbol"]
        name = c.get("company_name") or symbol
        label = _label(symbol, name)
        price = float(c.get("price") or 0)
        size_krw = auto_size if equal_weight else fixed_size
        if price <= 0 or size_krw <= 0:
            print(f"   ⚠️  {label}: 가격/사이즈 0 → 스킵")
            continue
        qty = int(size_krw // price)
        if qty <= 0:
            print(f"   ⚠️  {label}: position_size ₩{size_krw:,}로 1주도 못 매수 → 스킵")
            continue
        cost = qty * price
        if cost > cash:
            print(f"   ⚠️  {label}: 현금 부족 (₩{cash:,.0f} < ₩{cost:,.0f}) → 스킵")
            continue

        print(f"🔺 BUY {label} qty={qty} (gap={gap:+.2f}%, price≈₩{price:,.0f})")
        record = {"symbol": symbol, "name": name, "qty": qty, "gap": gap}
        if dry_run:
            record["dry_run"] = True
            buys.append(record)
            cash -= cost
            continue
        if _place_order_with_retry(kis, symbol, qty, side="buy"):
            buys.append(record)
            cash -= cost
            record_entry(
                strategy_id=strategy["id"],
                symbol=symbol,
                name=name,
                qty=qty,
                entry_price=price,
            )

    # ─── 5. last_rebalance_at 갱신 ────────────────────────────
    if not dry_run:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "UPDATE live_strategies SET last_rebalance_at = now() "
                        "WHERE id = :id"
                    ),
                    {"id": strategy["id"]},
                )
        except Exception as e:
            print(f"⚠️  last_rebalance_at 갱신 실패: {e}")

    print(f"✅ Live executor done — sells={len(sells)}, buys={len(buys)}")
    return {"status": "ok", "sells": sells, "buys": buys}
