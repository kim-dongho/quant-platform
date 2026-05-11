"""
라이브 매매 trade 로그 — 진입일·peak 가격을 보관해 time_exit / trailing_stop 평가를 가능하게 함.

KIS 잔고 응답에는 진입일·고가 정보가 없으므로, 이 모듈이 보유 종목별로 "open trade" 한 건씩
관리하고 청산 시 closing 한다.

엣지 케이스:
  - KIS 잔고에는 있는데 live_trades엔 없는 종목 (외부에서 매수): 이 모듈이 처음 만나면
    오늘을 entry_date로, 평단가를 entry_price로 가정해 row 생성. time_exit 카운트는 그때부터.
  - live_trades엔 있는데 KIS 잔고엔 없는 종목 (외부에서 매도): 외부 청산으로 간주해 close.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from sqlalchemy import text

from src.core.database import engine


# ─────────────────────────────────────────────────────────────
# 조회
# ─────────────────────────────────────────────────────────────
def get_open_trades(strategy_id: int) -> list[dict[str, Any]]:
    """전략의 open trades (exit_date IS NULL) 전체."""
    with engine.connect() as conn:
        rows = (
            conn.execute(
                text(
                    """
                SELECT id, symbol, name, qty, entry_date, entry_price, peak_price,
                       stop_order_no, stop_branch_no,
                       stop_trigger_price, stop_limit_price
                FROM live_trades
                WHERE strategy_id = :sid AND exit_date IS NULL
                ORDER BY entry_date ASC, id ASC
                """
                ),
                {"sid": strategy_id},
            )
            .mappings()
            .all()
        )
    return [dict(r) for r in rows]


def get_realized_pnl_summary(strategy_id: int) -> dict[str, Any]:
    """청산 완료된 trade 의 누적 실현손익 + 거래별 detail.

    external_close (시스템이 모르는 사이 청산된 종목 — 외부 매도 또는 symbol 마이그레이션
    잔재) 는 entry_price 로 close 되어 PnL 0 이라 응답에서 제외한다.
    """
    with engine.connect() as conn:
        rows = (
            conn.execute(
                text(
                    """
                SELECT id, symbol, name, qty, entry_date, entry_price,
                       exit_date, exit_price, exit_reason
                FROM live_trades
                WHERE strategy_id = :sid
                  AND exit_date IS NOT NULL
                  AND exit_reason <> 'external_close'
                ORDER BY exit_date DESC, id DESC
                """
                ),
                {"sid": strategy_id},
            )
            .mappings()
            .all()
        )

    trades: list[dict[str, Any]] = []
    total_cost = 0.0
    total_pnl = 0.0
    win = 0
    loss = 0
    for r in rows:
        d = dict(r)
        entry_px = float(d["entry_price"])
        exit_px = float(d["exit_price"])
        qty = int(d["qty"])
        pnl = qty * (exit_px - entry_px)
        pnl_pct = (exit_px / entry_px - 1.0) if entry_px > 0 else 0.0
        d["pnl_krw"] = round(pnl)
        d["pnl_pct"] = pnl_pct
        total_cost += qty * entry_px
        total_pnl += pnl
        if pnl > 0:
            win += 1
        elif pnl < 0:
            loss += 1
        trades.append(d)

    closed_count = win + loss
    return {
        "total_pnl_krw": round(total_pnl),
        "total_pnl_pct": (total_pnl / total_cost) if total_cost > 0 else 0.0,
        "closed_count": closed_count,
        "win_count": win,
        "loss_count": loss,
        "win_rate": (win / closed_count) if closed_count > 0 else 0.0,
        "trades": trades,
    }


def get_open_trade_by_symbol(strategy_id: int, symbol: str) -> Optional[dict[str, Any]]:
    with engine.connect() as conn:
        row = (
            conn.execute(
                text(
                    """
                SELECT id, symbol, name, qty, entry_date, entry_price, peak_price
                FROM live_trades
                WHERE strategy_id = :sid AND symbol = :sym AND exit_date IS NULL
                LIMIT 1
                """
                ),
                {"sid": strategy_id, "sym": symbol},
            )
            .mappings()
            .first()
        )
    return dict(row) if row else None


# ─────────────────────────────────────────────────────────────
# 기록
# ─────────────────────────────────────────────────────────────
def record_entry(
    strategy_id: int,
    symbol: str,
    name: Optional[str],
    qty: int,
    entry_price: float,
) -> int:
    """매수 체결 후 호출. 이미 open trade가 있으면 무시(중복 방지)."""
    with engine.begin() as conn:
        existing = conn.execute(
            text(
                "SELECT id FROM live_trades "
                "WHERE strategy_id = :sid AND symbol = :sym AND exit_date IS NULL"
            ),
            {"sid": strategy_id, "sym": symbol},
        ).scalar()
        if existing is not None:
            return int(existing)

        new_id = conn.execute(
            text(
                """
                INSERT INTO live_trades (
                    strategy_id, symbol, name, qty,
                    entry_date, entry_price, peak_price
                ) VALUES (
                    :sid, :sym, :name, :qty,
                    CURRENT_DATE, :px, :px
                ) RETURNING id
                """
            ),
            {
                "sid": strategy_id,
                "sym": symbol,
                "name": name,
                "qty": qty,
                "px": entry_price,
            },
        ).scalar()
    return int(new_id)


def record_exit(trade_id: int, exit_price: float, reason: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE live_trades
                SET exit_date = CURRENT_DATE,
                    exit_price = :px,
                    exit_reason = :reason,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": trade_id, "px": exit_price, "reason": reason},
        )


def update_peak_price(trade_id: int, current_price: float) -> None:
    """현재가가 peak_price보다 크면 갱신 (trailing_stop 추적용)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE live_trades
                SET peak_price = GREATEST(peak_price, :cur),
                    updated_at = now()
                WHERE id = :id AND exit_date IS NULL
                """
            ),
            {"id": trade_id, "cur": current_price},
        )


def record_stop_order(
    trade_id: int,
    order_no: str,
    branch_no: str,
    trigger_price: float,
    limit_price: float,
) -> None:
    """KIS 스탑지정가 매도 주문 발사 후 메타를 trade row 에 보관."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE live_trades
                SET stop_order_no = :ono,
                    stop_branch_no = :bno,
                    stop_trigger_price = :tp,
                    stop_limit_price = :lp,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {
                "id": trade_id,
                "ono": order_no,
                "bno": branch_no,
                "tp": trigger_price,
                "lp": limit_price,
            },
        )


def clear_stop_order(trade_id: int) -> None:
    """trade row 의 stop 메타 null 로 — 취소 또는 발동 후 호출."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE live_trades
                SET stop_order_no = NULL,
                    stop_branch_no = NULL,
                    stop_trigger_price = NULL,
                    stop_limit_price = NULL,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": trade_id},
        )


# ─────────────────────────────────────────────────────────────
# KIS 잔고와 sync
# ─────────────────────────────────────────────────────────────
def sync_with_holdings(
    strategy_id: int, holdings: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    """
    KIS 잔고와 live_trades를 정렬:
      1) 잔고에 있지만 live_trades에 없는 종목 → 오늘을 entry_date로 row 생성
         (외부에서 매수했거나 자동매매 시작 이전 보유분)
      2) live_trades에 있지만 잔고에 없는 종목 → 외부 청산으로 간주해 close
      3) 보유 중 종목들의 peak_price를 현재가로 갱신

    반환: { symbol: trade_dict } — 보유 종목별 open trade 매핑.
    """
    held = {h["symbol"]: h for h in holdings if int(h.get("qty") or 0) > 0}
    open_trades = {t["symbol"]: t for t in get_open_trades(strategy_id)}

    # 1) 잔고에만 있는 종목 → entry 생성
    for symbol, h in held.items():
        if symbol in open_trades:
            continue
        avg_cost = float(h.get("avg_cost") or 0)
        if avg_cost <= 0:
            continue
        tid = record_entry(
            strategy_id=strategy_id,
            symbol=symbol,
            name=h.get("name"),
            qty=int(h["qty"]),
            entry_price=avg_cost,
        )
        # 새로 만든 entry로 매핑 갱신
        new_t = get_open_trade_by_symbol(strategy_id, symbol)
        if new_t:
            open_trades[symbol] = new_t
        else:
            open_trades[symbol] = {
                "id": tid,
                "symbol": symbol,
                "name": h.get("name"),
                "qty": int(h["qty"]),
                "entry_date": date.today(),
                "entry_price": avg_cost,
                "peak_price": avg_cost,
            }
        print(
            f"   📝 {symbol} ({h.get('name') or symbol}): trade 신규 기록 (avg_cost ₩{avg_cost:,.0f})"
        )

    # 2) trade에만 있는 종목 → 외부 청산으로 close
    for symbol, t in list(open_trades.items()):
        if symbol in held:
            continue
        # 현재가 모름 → entry_price로 close (PnL 0 가정). 정확도가 떨어지지만
        # "외부 청산"임을 reason으로 명시.
        record_exit(t["id"], exit_price=t["entry_price"], reason="external_close")
        del open_trades[symbol]
        print(f"   🧹 {symbol}: 잔고에 없음 → trade close (external_close)")

    # 3) peak_price 갱신
    for symbol, t in open_trades.items():
        h = held.get(symbol)
        if not h:
            continue
        cur = float(h.get("current_price") or 0)
        if cur > float(t["peak_price"]):
            update_peak_price(t["id"], cur)
            t["peak_price"] = cur

    return open_trades
