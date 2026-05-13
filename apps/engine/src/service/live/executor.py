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
from src.service.live.notify import notify_slack
from src.service.live.strategy import get_active_strategy
from src.service.live.trades import (
    clear_stop_order,
    record_entry,
    record_exit,
    record_stop_order,
    sync_with_holdings,
)
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

# 스탑지정가 (ORD_DVSN=22) 안전마진. trigger 보다 limit 을 이만큼 낮게 잡아
# 갭다운으로 시초가가 trigger 보다 낮아도 체결 보장.
STOP_LIMIT_MARGIN_PCT = -2.0

# 매수 지정가 마진 — 어제 종가 × (1 + 이 값) 으로 발주.
# 갭 필터 ±5% 와 일관 — 그 안에서 움직이는 종목은 체결, 갑자기 +5% 튀어오르면 미체결 (보호).
# 정규장 시간 (15:15) 에 발주하면 호가창 매물 있어 거의 즉시 체결.
BUY_LIMIT_MARGIN_PCT = 5.0


def _get_yesterday_close(symbol: str) -> Optional[float]:
    """market_data에서 종목의 가장 최근(=어제) 종가."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT close FROM market_data WHERE symbol = :s ORDER BY time DESC LIMIT 1"),
            {"s": symbol},
        ).fetchone()
    return float(row[0]) if row and row[0] is not None else None


def _today_quote_info(symbol: str, kis: KisClient) -> Optional[dict[str, Any]]:
    """오늘 시가 갭 + 종목 상태 코드. 데이터 없으면 None.

    반환: {"gap_pct": float, "status_code": str}
      gap_pct: 오늘 시가가 어제 종가 대비 몇 %.
      status_code: KIS iscd_stat_cls_code — 00=정상, 51~56=위험/정지.

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
    return {
        "gap_pct": (open_price / yesterday_close - 1) * 100,
        "status_code": quote.get("status_code") or "",
    }


# 매수 차단할 KIS 종목 상태 코드 — 관리/정리매매/투자위험/경고/매매정지/주의.
# 빈 문자열 또는 "00" 은 정상이라 매수 허용.
KIS_RISKY_STATUS_CODES = {"51", "52", "53", "54", "55", "56"}


def _to_code(symbol: str) -> str:
    """KIS 형식('000150') 과 DB 형식('000150.KS') 비교용 — 6자리 코드만 추출."""
    return symbol.split(".")[0] if symbol else symbol


def _label(symbol: str, name: Optional[str]) -> str:
    """로그·UI용 표시: '종목명 (티커)' 또는 이름 없으면 티커만."""
    if name and name != symbol:
        return f"{name} ({symbol})"
    return symbol


def _place_order_with_retry(
    kis: KisClient,
    symbol: str,
    qty: int,
    side: str,
    price: Optional[float] = None,
) -> bool:
    """KIS 주문 발송 + rate limit(EGW00201) 시 1회 재시도. 성공 True.

    price 가 주어지면 지정가(ORD_DVSN=00), 없으면 시장가(ORD_DVSN=01).
    매수는 보통 지정가 + 안전 마진으로 — 정규장 즉시 체결 + KIS 매수가능액 검증 정확.
    매도는 시장가로 — 동시호가 단일가에 무조건 체결.
    """
    order_type = "limit" if price is not None and price > 0 else "market"
    for attempt in range(2):
        try:
            kis.place_order(symbol=symbol, qty=qty, side=side, order_type=order_type, price=price)
            return True
        except KisError as e:
            if "EGW00201" in str(e) and attempt == 0:
                time.sleep(KIS_RATE_LIMIT_RETRY_SLEEP_SEC)
                continue
            print(f"   ❌ {side} failed: {e}")
            return False
    return False


def _maybe_place_stop(
    kis: KisClient,
    trade_id: int,
    symbol: str,
    qty: int,
    reference_price: float,
    policy: ExitPolicy,
    label: str,
) -> None:
    """매수 직후 또는 trailing 재조정 시 KIS 스탑지정가 발사 + DB 메타 저장.

    reference_price: 진입가 (정적 stop) 또는 peak_price (trailing).
    실패해도 거래 자체는 진행 — print 만 하고 다음으로.

    paper 모드는 ORD_DVSN=22 (스탑지정가) 미지원 — 종가 기준 cron 평가 (_evaluate_exits)
    에만 의존. 시도 자체 skip 해서 무의미한 KIS 에러 호출 회피.
    """
    if qty <= 0 or reference_price <= 0:
        return
    if policy.stop_loss_pct is None:
        return  # stop 정책 없으면 발사 X
    if kis.mode == "paper":
        return  # 모의투자 미지원

    trigger = reference_price * (1 + policy.stop_loss_pct / 100)
    limit = trigger * (1 + STOP_LIMIT_MARGIN_PCT / 100)
    try:
        resp = kis.place_stop_sell(symbol=symbol, qty=qty, trigger_price=trigger, limit_price=limit)
        record_stop_order(
            trade_id=trade_id,
            order_no=resp.get("order_no") or "",
            branch_no=resp.get("branch_no") or "",
            trigger_price=trigger,
            limit_price=limit,
        )
        print(
            f"   🛡️  stop-loss @ ₩{trigger:,.0f} (limit ₩{limit:,.0f}) "
            f"[order={resp.get('order_no')}]"
        )
    except KisError as e:
        print(f"   ⚠️  {label} stop-loss 발사 실패: {e}")


def _maybe_cancel_stop(kis: KisClient, trade: dict[str, Any]) -> None:
    """청산 직전 기존 stop 주문 취소 — 같은 종목에 stop+일반매도 충돌 방지."""
    order_no = trade.get("stop_order_no")
    branch_no = trade.get("stop_branch_no")
    if not order_no or not branch_no:
        return
    try:
        kis.cancel_order(branch_no=branch_no, order_no=order_no)
        if trade.get("id") is not None:
            clear_stop_order(int(trade["id"]))
    except KisError as e:
        # 이미 발동/만료된 주문일 수도 있어 경고만.
        print(f"   ⚠️  stop cancel 실패: {e}")


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


def run_once(dry_run: bool = False, mode: str = "paper") -> dict[str, Any]:
    """라이브 매매 1회 실행 (지정 mode). cron 이 mode 별로 호출.

    mode='paper' or 'real' — 두 모드는 KIS 키·계좌가 다르므로 별도 KisClient 사용.
    """
    print(f"🤖 Live executor start (mode={mode}, dry_run={dry_run})")

    strategy = get_active_strategy(mode=mode)
    if not strategy:
        print(f"⚠️  활성 {mode} 전략 없음 — 종료")
        return {"status": "no_strategy", "mode": mode}

    print(
        f"📋 Strategy ({mode}): {strategy['name']} "
        f"(universe={strategy['universe']}, max_positions={strategy['max_positions']})"
    )

    if not dry_run:
        notify_slack(f"🕗 *{strategy['name']}* [{mode}] 매매 사이클 시작")

    kis = get_kis_client(mode=mode)
    try:
        balance = kis.get_balance()
    except KisError as e:
        print(f"❌ KIS balance failed: {e}")
        if not dry_run:
            notify_slack(f"❌ *{strategy['name']}* [{mode}] — KIS 잔고 조회 실패\n```{e}```")
        return {"status": "kis_error", "error": str(e), "mode": mode}

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
        # 일반 매도 전에 기존 stop 주문 취소 — 미체결 stop 이 잔고 부족으로
        # 다음 cron 까지 남아있는 걸 방지.
        trade = open_trades.get(symbol)
        if trade:
            _maybe_cancel_stop(kis, trade)
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
        return {"status": "ok", "sells": sells, "buys": [], "mode": mode}

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
        if not dry_run:
            notify_slack(f"❌ *{strategy['name']}* [{mode}] — screen 실패\n```{e}```")
        return {"status": "screen_error", "error": str(e), "sells": sells, "buys": [], "mode": mode}

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
    # raw_candidates 전체를 순회하되 selected 가 빈 슬롯만큼 차면 즉시 중단.
    # 이전 구현은 open_slots*3 으로만 잘라서 봤는데, 갭 초과 종목이 그 안에 몰리면
    # selected 가 0 으로 끝나서 빈 슬롯이 남는 버그. KIS rate limit 은 호출 간
    # sleep 으로 회피.
    for i, c in enumerate(raw_candidates):
        if len(selected) >= open_slots:
            break
        if i > 0:
            time.sleep(KIS_QUOTE_SLEEP_SEC)
        symbol = c["symbol"]
        label = _label(symbol, c.get("company_name"))
        info = _today_quote_info(symbol, kis)
        if info is None:
            print(f"   ⚠️  {label}: 시가 데이터 없음 → 스킵")
            continue
        # 관리/투자위험/매매정지 등 — 매수 금지.
        if info["status_code"] in KIS_RISKY_STATUS_CODES:
            print(f"   🚧 {label}: 위험종목 (KIS status={info['status_code']}) → 스킵")
            continue
        gap = info["gap_pct"]
        if abs(gap) > GAP_FILTER_PCT:
            print(f"   🚫 {label}: 시가 갭 {gap:+.2f}% (>±{GAP_FILTER_PCT}%) → 스킵")
            continue
        selected.append((c, gap))

    # ─── 4. 매수 주문 ────────────────────────────────────────
    # position_size_krw > 0 → 종목당 고정 배분 (사용자 명시).
    # position_size_krw <= 0 → ranking 우선 라운드로빈 (자본 활용도 극대화).
    #   1라운드: ranking 1위부터 N위까지 각 1주씩 (자본 부족하면 거기서 중단)
    #   2라운드+: 자본 남으면 ranking 1위부터 한 주씩 추가 매수
    #   효과: 비싼 ranking 상위 종목도 1주는 보유 → 분산 + ranking 알파 동시 확보
    fixed_size = int(strategy.get("position_size_krw") or 0)
    equal_weight = fixed_size <= 0

    buys: list[dict[str, Any]] = []
    qty_by_idx: list[int] = [0] * len(selected)
    prices = [float(c.get("price") or 0) for c, _ in selected]

    if equal_weight:
        # ranking 우선 라운드로빈 — 자본 다 쓸 때까지
        cash_pool = float(cash)
        while True:
            progressed = False
            for i, p in enumerate(prices):
                if p > 0 and cash_pool >= p:
                    qty_by_idx[i] += 1
                    cash_pool -= p
                    progressed = True
            if not progressed:
                break
        print(
            f"💸 ranking 우선 분배 — 잔고 ₩{cash:,.0f} → 매수 예정 ₩{cash - cash_pool:,.0f} "
            f"(잔여 ₩{cash_pool:,.0f})"
        )
    else:
        # 종목당 고정 배분 — 기존 동작 유지
        for i, p in enumerate(prices):
            if p > 0:
                qty_by_idx[i] = int(fixed_size // p)

    for i, (c, gap) in enumerate(selected):
        symbol = c["symbol"]
        name = c.get("company_name") or symbol
        label = _label(symbol, name)
        price = prices[i]
        qty = qty_by_idx[i]
        if price <= 0:
            print(f"   ⚠️  {label}: 가격 0 → 스킵")
            continue
        if qty <= 0:
            print(f"   ⚠️  {label}: 자본 부족 → 스킵 (price=₩{price:,.0f})")
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
            if policy.stop_loss_pct is not None:
                trigger = price * (1 + policy.stop_loss_pct / 100)
                limit = trigger * (1 + STOP_LIMIT_MARGIN_PCT / 100)
                print(f"   🛡️  (dry-run) stop-loss @ ₩{trigger:,.0f} (limit ₩{limit:,.0f})")
            continue
        if buys and not dry_run:
            time.sleep(KIS_QUOTE_SLEEP_SEC)
        # 지정가 + 5% 마진 — 정규장 시간 즉시 체결 + KIS 검증 정확 (시장가 +30% 마진 문제 회피).
        limit_price = price * (1 + BUY_LIMIT_MARGIN_PCT / 100)
        if _place_order_with_retry(kis, symbol, qty, side="buy", price=limit_price):
            buys.append(record)
            cash -= cost
            trade_id = record_entry(
                strategy_id=strategy["id"],
                symbol=symbol,
                name=name,
                qty=qty,
                entry_price=price,
            )
            # 매수 직후 KIS 스탑지정가 매도 발사 — entry_price 기준 정적 stop.
            # trailing 재조정은 다음 cron 의 peak_price 갱신 후 별도 phase 에서 처리.
            time.sleep(KIS_QUOTE_SLEEP_SEC)
            _maybe_place_stop(
                kis=kis,
                trade_id=trade_id,
                symbol=symbol,
                qty=qty,
                reference_price=price,
                policy=policy,
                label=label,
            )

    # ─── 5. 기존 보유분 stop 발사 보강 ────────────────────────
    # 이번 cron 의 신규 매수는 매수 직후 stop 을 같이 발사하지만, 어제 매수해서
    # stop 메타 없이 들어온 보유분 + 코드 도입 이전부터 가지고 있던 종목까지
    # 모두 stop 보호되도록 여기서 한 번 보강. 이미 stop_order_no 가 있으면 skip.
    if not dry_run and policy.stop_loss_pct is not None:
        for h in holdings:
            symbol = h.get("symbol")
            if not symbol or symbol in sold_syms:
                continue
            trade = open_trades.get(symbol)
            if not trade or trade.get("stop_order_no"):
                continue
            qty = int(h.get("qty") or 0)
            avg_cost = float(h.get("avg_cost") or 0)
            if qty <= 0 or avg_cost <= 0:
                continue
            time.sleep(KIS_QUOTE_SLEEP_SEC)
            _maybe_place_stop(
                kis=kis,
                trade_id=int(trade["id"]),
                symbol=symbol,
                qty=qty,
                reference_price=avg_cost,
                policy=policy,
                label=_label(symbol, h.get("name")),
            )

    # ─── 6. last_rebalance_at 갱신 ────────────────────────────
    if not dry_run:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("UPDATE live_strategies SET last_rebalance_at = now() WHERE id = :id"),
                    {"id": strategy["id"]},
                )
        except Exception as e:
            print(f"⚠️  last_rebalance_at 갱신 실패: {e}")

    print(f"✅ Live executor done — sells={len(sells)}, buys={len(buys)}")

    # ─── 6. Slack 알림 (실거래만) ─────────────────────────────
    if not dry_run:
        # reason 별 매도 카운트 — stop_loss 같은 위험 신호를 사용자가 빨리 알 수 있게
        from collections import Counter

        reason_counts = Counter(s["reason"] for s in sells)
        reason_str = ", ".join(f"{r}×{c}" for r, c in reason_counts.most_common()) if sells else "—"
        sell_lines = "\n".join(f"  🔻 {s['name']} ({s['reason']})" for s in sells[:5]) or "  —"
        buy_lines = "\n".join(f"  🟢 {b['name']}" for b in buys[:5]) or "  —"
        more_sells = f"\n  …외 {len(sells) - 5}건" if len(sells) > 5 else ""
        more_buys = f"\n  …외 {len(buys) - 5}건" if len(buys) > 5 else ""
        notify_slack(
            f"🤖 *{strategy['name']}* [{mode}] 매매 완료\n"
            f"매도 {len(sells)} | 매수 {len(buys)} | 매수가능 ₩{cash:,.0f}\n"
            f"매도 사유: {reason_str}\n"
            f"*매도 종목*\n{sell_lines}{more_sells}\n"
            f"*매수 종목*\n{buy_lines}{more_buys}"
        )

    return {"status": "ok", "sells": sells, "buys": buys, "mode": mode}


def run_once_all(dry_run: bool = False) -> dict[str, Any]:
    """활성화된 paper / real 모두 순차 실행. cron 단일 호출로 양쪽 처리.

    한쪽 mode 가 실패해도 다른쪽은 계속 진행.
    """
    results: dict[str, Any] = {}
    for mode in ("paper", "real"):
        try:
            results[mode] = run_once(dry_run=dry_run, mode=mode)
        except Exception as e:
            print(f"❌ run_once[{mode}] 예외: {e}")
            results[mode] = {"status": "exception", "error": str(e), "mode": mode}
    return results


# ─────────────────────────────────────────────────────────────
# Stop-loss 재발사 전용 — 매일 09:00 cron 으로 호출.
# KIS 정규주문(ORD_DVSN=22) 은 당일 유효(장 마감 시 자동 취소) 라
# 매일 정규장 시작 시 보유 종목에 stop 을 다시 발사해 안전망 유지.
# ─────────────────────────────────────────────────────────────
def run_stop_refresh(dry_run: bool = False, mode: str = "paper") -> dict[str, Any]:
    """보유 종목 stop-loss 재발사 (매수/매도 phase 없음).

    흐름:
      1. 활성 전략 / KIS 잔고 로드
      2. sync_with_holdings — 외부 매수/매도 반영 + peak_price 갱신
      3. 보유 종목 중 stop_order_no 없는 것에 stop 발사
         (전일 stop 이 KIS 에 의해 자동 취소되었으므로 모두 NULL 상태일 것)

    매수/매도 평가는 일절 안 함 — 그건 15:15 매매 cron 의 책임.
    """
    print(f"🛡️  Stop refresh start (mode={mode}, dry_run={dry_run})")

    if mode == "paper":
        # KIS 모의투자는 스탑지정가(ORD_DVSN=22) 미지원 — paper 는 종가 기준 cron
        # 평가만으로 손절 처리. 자동 안전망(intraday) 은 real 에만 적용.
        print("ℹ️  paper 는 KIS 스탑지정가 미지원 — 종료 (종가 기준 평가는 매매 cron 에서)")
        return {"status": "unsupported_mode", "mode": "paper", "refreshed": 0}

    strategy = get_active_strategy(mode=mode)
    if not strategy:
        print(f"⚠️  활성 {mode} 전략 없음 — 종료")
        return {"status": "no_strategy", "mode": mode}

    policy = ExitPolicy.from_dict(strategy.get("exit_policy"))
    if policy.stop_loss_pct is None:
        print(f"⏭️  {strategy['name']} [{mode}] stop_loss_pct 없음 — 건너뜀")
        return {"status": "no_policy", "mode": mode, "refreshed": 0}

    kis = get_kis_client(mode=mode)
    try:
        balance = kis.get_balance()
    except KisError as e:
        print(f"❌ KIS balance failed: {e}")
        if not dry_run:
            notify_slack(
                f"❌ *{strategy['name']}* [{mode}] — stop refresh KIS 잔고 조회 실패\n```{e}```"
            )
        return {"status": "kis_error", "error": str(e), "mode": mode}

    holdings: list[dict[str, Any]] = balance.get("holdings") or []
    if not holdings:
        print(f"📒 보유 종목 없음 — 종료 [{mode}]")
        return {"status": "ok", "mode": mode, "refreshed": 0}

    # sync — 매일 09:00 시점에 외부 매수/매도 반영 + peak 갱신
    if dry_run:
        from src.service.live.trades import get_open_trades

        open_trades = {_to_code(t["symbol"]): t for t in get_open_trades(strategy["id"])}
        print(f"📒 Open trades (dry-run, no sync): {len(open_trades)}개")
    else:
        open_trades = sync_with_holdings(strategy["id"], holdings)
        print(f"📒 Open trades (synced): {len(open_trades)}개")

    refreshed: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    for h in holdings:
        symbol = h.get("symbol")
        if not symbol:
            continue
        code = _to_code(symbol)
        trade = open_trades.get(code)
        if not trade:
            continue  # sync 가 못 잡은 외부 보유분 — 다음 cron 에서 처리
        if trade.get("stop_order_no"):
            # KIS 가 당일 유효라 자동 취소했어야 하지만, 혹시 남아있으면 skip.
            # 다음 작업: cancel 후 재발사로 매일 일관성 보장 가능.
            print(f"   ⏭️  {_label(symbol, h.get('name'))}: stop_order_no 이미 있음 — skip")
            continue
        qty = int(h.get("qty") or 0)
        avg_cost = float(h.get("avg_cost") or 0)
        if qty <= 0 or avg_cost <= 0:
            continue

        label = _label(symbol, h.get("name"))
        if dry_run:
            trigger = avg_cost * (1 + policy.stop_loss_pct / 100)
            limit = trigger * (1 + STOP_LIMIT_MARGIN_PCT / 100)
            print(f"   🛡️  (dry-run) {label} stop @ ₩{trigger:,.0f} (limit ₩{limit:,.0f})")
            refreshed.append({"symbol": code, "name": h.get("name") or symbol, "qty": qty})
            continue

        time.sleep(KIS_QUOTE_SLEEP_SEC)
        before = trade.get("stop_order_no")
        _maybe_place_stop(
            kis=kis,
            trade_id=int(trade["id"]),
            symbol=symbol,
            qty=qty,
            reference_price=avg_cost,
            policy=policy,
            label=label,
        )
        # _maybe_place_stop 가 record_stop_order 호출 시 stop_order_no 갱신.
        # 검증을 위해 다시 trade 조회는 비용이라 생략 — 실패시 print 로 보임.
        record = {"symbol": code, "name": h.get("name") or symbol, "qty": qty}
        if before is None:
            refreshed.append(record)
        else:
            failed.append(record)

    print(f"✅ Stop refresh done [{mode}] — refreshed={len(refreshed)}, failed={len(failed)}")

    # Slack 알림 — 보호 상태를 매일 한 줄로 알 수 있게
    if not dry_run:
        if refreshed or failed:
            lines = "\n".join(f"  🛡️  {r['name']} ×{r['qty']}" for r in refreshed[:8]) or "  —"
            more = f"\n  …외 {len(refreshed) - 8}건" if len(refreshed) > 8 else ""
            extras = ""
            if failed:
                extras = f"\n⚠️  발사 실패 {len(failed)}건"
            notify_slack(
                f"🛡️  *{strategy['name']}* [{mode}] stop 재발사\n"
                f"보호 {len(refreshed)} / 보유 {len(holdings)}{extras}\n"
                f"*재발사 종목*\n{lines}{more}"
            )

    return {
        "status": "ok",
        "mode": mode,
        "refreshed": len(refreshed),
        "failed": len(failed),
        "refreshed_items": refreshed,
        "failed_items": failed,
    }


def run_stop_refresh_all(dry_run: bool = False) -> dict[str, Any]:
    """활성화된 paper / real 모두에 stop 재발사. 09:00 cron 단일 호출용."""
    results: dict[str, Any] = {}
    for mode in ("paper", "real"):
        try:
            results[mode] = run_stop_refresh(dry_run=dry_run, mode=mode)
        except Exception as e:
            print(f"❌ run_stop_refresh[{mode}] 예외: {e}")
            results[mode] = {"status": "exception", "error": str(e), "mode": mode}
    return results
