import pandas as pd
import numpy as np
import pandas_ta as ta
from src.core.database import engine

def calculate_strategy(ticker: str, params: dict):
    query = f"SELECT time, open, high, low, close, volume FROM market_data WHERE symbol = '{ticker}' ORDER BY time ASC"
    df = pd.read_sql(query, engine)
    
    if df.empty:
        return {"error": "No data"}

    df.columns = [c.lower() for c in df.columns]

    # 1. 지표 계산
    df['sma_s'] = ta.sma(df['close'], length=params.get('sma_short', 5))
    df['sma_l'] = ta.sma(df['close'], length=params.get('sma_long', 20))
    df['rsi'] = ta.rsi(df['close'], length=params.get('rsi_period', 14))
    
    macd = ta.macd(df['close'])
    df['macd'] = macd.iloc[:, 0]
    df['macd_s'] = macd.iloc[:, 2]

    # ---------------------------------------------------------
    # 🧠 핵심 로직: 포지션 기반 백테스팅
    # ---------------------------------------------------------
    # - 매수(Buy): 단기 이평선이 장기 이평선 위에 있고(정배열), RSI가 너무 높지 않을 때
    # - 매도(Sell): 단기 이평선이 장기 이평선을 하향 돌파할 때
    
    df['signal'] = 0
    position = 0  # 0: 현금, 1: 주식 보유
    signals = []

    for i in range(len(df)):
        current_close = df['close'].iloc[i]
        current_rsi = df['rsi'].iloc[i]
        sma_s = df['sma_s'].iloc[i]
        sma_l = df['sma_l'].iloc[i]

        # 데이터가 충분치 않으면 패스
        if pd.isna(sma_l) or pd.isna(current_rsi):
            signals.append(0)
            continue

        # 매수 조건: 정배열 진입 + RSI가 과매수(예: 70)가 아닐 때
        if position == 0:
            if sma_s > sma_l and current_rsi < params.get('rsi_buy_k', 60):
                position = 1
                signals.append(1)
            else:
                signals.append(0)
        
        # 매도 조건: 역배열 발생 시 즉시 매도 (리스크 관리)
        elif position == 1:
            if sma_s < sma_l:
                position = 0
                signals.append(0)
            else:
                signals.append(1) # 보유 유지

    df['position'] = signals

    # ---------------------------------------------------------
    # 💰 수익률 계산
    # ---------------------------------------------------------
    df['pct_change'] = df['close'].pct_change().shift(-1)
    df['strategy_return'] = df['pct_change'] * df['position']
    
    # 누적 수익률 계산
    df['cum_ret'] = (1 + df['strategy_return'].fillna(0)).cumprod()

    df['time_str'] = df['time'].dt.strftime('%Y-%m-%d')
    
    # - 동일 날짜가 여러 번 나오는 경우 마지막 데이터만 유지 (중복 방지)
    df_clean = df.drop_duplicates(subset=['time_str'], keep='last')
    
    # - NaN 데이터 제거 (지표 계산 초기에 발생하는 NaN 행 삭제)
    df_clean = df_clean.dropna(subset=['cum_ret'])

    # 프론트엔드가 즉시 사용할 수 있는 [{time, value}, ...] 구조로 변환
    results = [
        {
            "time": t, 
            "value": round(float(v), 4)
        }
        for t, v in zip(df_clean['time_str'], df_clean['cum_ret'])
    ]

    return {
        "ticker": ticker,
        "results": results,
        "final_return": round((df_clean['cum_ret'].iloc[-1] - 1) * 100, 2)
    }