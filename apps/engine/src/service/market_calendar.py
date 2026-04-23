from datetime import datetime, timedelta, timezone

import pandas_market_calendars as mcal


def get_last_session_date(market: str = "NASDAQ") -> str:
    """
    가장 최근에 '마감'된 거래 세션 날짜(YYYY-MM-DD)를 반환.
    장이 아직 열려 있는 날은 제외하고, 가장 최근 종가가 확정된 세션을 기준으로 삼는다.
    주말/공휴일은 자동으로 제외됨.

    기본값 NASDAQ: S&P 500/NASDAQ 100 대부분이 NASDAQ 상장.
    (NYSE와 정규장 시간·공휴일은 동일하지만 시맨틱상 명시)
    """
    cal = mcal.get_calendar(market)
    now = datetime.now(timezone.utc)

    # 넉넉히 30일 범위 조회 (장기 공휴일 등 방어)
    start = (now - timedelta(days=30)).date()
    end = now.date()

    schedule = cal.schedule(start_date=start, end_date=end)
    closed = schedule[schedule["market_close"] <= now]

    if closed.empty:
        # 이례적인 케이스 방어: 30일간 마감 세션이 하나도 없으면 하루 전을 fallback
        return (now - timedelta(days=1)).strftime("%Y-%m-%d")

    return closed.index[-1].strftime("%Y-%m-%d")
