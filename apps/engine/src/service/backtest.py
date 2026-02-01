import pandas as pd
import numpy as np
import pandas_ta as ta
from src.core.database import engine

def calculate_strategy(ticker: str, params: dict):
    # 1. 데이터 로드
    query = f"SELECT time, open, high, low, close, volume FROM market_data WHERE symbol = '{ticker}' ORDER BY time ASC"
    df = pd.read_sql(query, engine)
    
    if df.empty:
        return {"error": "No data"}

    df.columns = [c.lower() for c in df.columns]
    df['time'] = pd.to_datetime(df['time'])

    # 2. 지표 계산 (Indicators)
    # 이평선
    df['sma_s'] = ta.sma(df['close'], length=params.get('sma_short', 5))
    df['sma_l'] = ta.sma(df['close'], length=params.get('sma_long', 20))
    
    # RSI
    df['rsi'] = ta.rsi(df['close'], length=params.get('rsi_period', 14))
    
    # MACD
    macd = ta.macd(df['close'])
    df['macd'] = macd.iloc[:, 0]    # MACD Line
    df['macd_s'] = macd.iloc[:, 2]  # Signal Line
    df['macd_h'] = macd.iloc[:, 1]  # Histogram

    # 볼린저 밴드 (Bollinger Bands) ✅ 추가
    bbands = ta.bbands(df['close'], length=20, std=2)
    df['bb_l'] = bbands.iloc[:, 0]  # Lower Band
    df['bb_m'] = bbands.iloc[:, 1]  # Middle Band
    df['bb_u'] = bbands.iloc[:, 2]  # Upper Band

    # 3. 핵심 로직: 포지션 기반 백테스팅
    df['signal'] = 0
    position = 0  # 0: 현금, 1: 주식 보유
    signals = []

    for i in range(len(df)):
        current_close = df['close'].iloc[i]
        current_rsi = df['rsi'].iloc[i]
        sma_s = df['sma_s'].iloc[i]
        sma_l = df['sma_l'].iloc[i]

        if pd.isna(sma_l) or pd.isna(current_rsi):
            signals.append(0)
            continue

        # 매수 조건: 정배열 진입 + RSI 필터
        if position == 0:
            if sma_s > sma_l and current_rsi < params.get('rsi_buy_k', 60):
                position = 1
                signals.append(1)
            else:
                signals.append(0)
        
        # 매도 조건: 역배열 발생 시 즉시 매도
        elif position == 1:
            if sma_s < sma_l:
                position = 0
                signals.append(0)
            else:
                signals.append(1) 

    df['position'] = signals

    # 4. 수익률 계산
    df['pct_change'] = df['close'].pct_change().shift(-1)
    df['strategy_return'] = df['pct_change'] * df['position']
    df['cum_ret'] = (1 + df['strategy_return'].fillna(0)).cumprod()

    # 5. 데이터 정제 (중복 제거 및 포맷팅)
    df['time_str'] = df['time'].dt.strftime('%Y-%m-%d')
    df_clean = df.drop_duplicates(subset=['time_str'], keep='last').copy()
    df_clean = df_clean.dropna(subset=['cum_ret'])

    # 

    # 6. 결과 패킹 (프론트엔드 Stack 구조를 위한 데이터 포함)
    results = []
    for _, row in df_clean.iterrows():
        item = {
            "time": row['time_str'],
            "value": round(float(row['cum_ret']), 4),
            # 보조지표 데이터 추가 (null 체크 포함)
            "rsi": round(float(row['rsi']), 2) if not pd.isna(row['rsi']) else None,
            "macd": round(float(row['macd']), 2) if not pd.isna(row['macd']) else None,
            "macd_h": round(float(row['macd_h']), 2) if not pd.isna(row['macd_h']) else None,
            "bb_u": round(float(row['bb_u']), 2) if not pd.isna(row['bb_u']) else None,
            "bb_m": round(float(row['bb_m']), 2) if not pd.isna(row['bb_m']) else None,
            "bb_l": round(float(row['bb_l']), 2) if not pd.isna(row['bb_l']) else None,
        }
        results.append(item)

    return {
        "ticker": ticker,
        "results": results,
        "final_return": round((df_clean['cum_ret'].iloc[-1] - 1) * 100, 2)
    }