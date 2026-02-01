import pandas as pd
import numpy as np
import pandas_ta as ta
from src.core.database import engine

def calculate_strategy(ticker: str, params: dict):
    # ==========================================
    # 1. 데이터 로드 (Data Loading)
    # ==========================================
    query = f"SELECT time, open, high, low, close, volume FROM market_data WHERE symbol = '{ticker}' ORDER BY time ASC"
    df = pd.read_sql(query, engine)
    
    if df.empty:
        return {"error": "No data"}

    df.columns = [c.lower() for c in df.columns]
    df['time'] = pd.to_datetime(df['time'])

    # ==========================================
    # 2. 지표 계산 (Indicators Calculation)
    # ==========================================
    
    # (1) SMA (이동평균선)
    # pandas_ta는 결과가 Series로 나오므로 바로 할당
    df['sma_s'] = ta.sma(df['close'], length=int(params.get('sma_short', 5)))
    df['sma_l'] = ta.sma(df['close'], length=int(params.get('sma_long', 20)))
    
    # (2) RSI (상대강도지수)
    df['rsi'] = ta.rsi(df['close'], length=14)
    
    # (3) MACD (이동평균 수렴확산)
    # macd()는 DataFrame을 반환: [MACD_fast_slow_signal, MACDh_..., MACDs_...]
    macd_df = ta.macd(
        df['close'], 
        fast=int(params.get('macd_fast', 12)), 
        slow=int(params.get('macd_slow', 26)), 
        signal=int(params.get('macd_sig', 9))
    )
    # pandas_ta 반환 컬럼명은 동적이므로 iloc로 안전하게 가져옴
    if macd_df is not None:
        df['macd'] = macd_df.iloc[:, 0]    # MACD Line
        df['macd_h'] = macd_df.iloc[:, 1]  # Histogram
        df['macd_s'] = macd_df.iloc[:, 2]  # Signal Line
    else:
        df['macd'] = df['macd_h'] = df['macd_s'] = None

    # (4) Bollinger Bands (볼린저 밴드)
    bb_df = ta.bbands(
        df['close'], 
        length=int(params.get('bb_window', 20)), 
        std=float(params.get('bb_std', 2.0))
    )
    if bb_df is not None:
        df['bb_l'] = bb_df.iloc[:, 0]  # Lower
        df['bb_m'] = bb_df.iloc[:, 1]  # Middle
        df['bb_u'] = bb_df.iloc[:, 2]  # Upper
    else:
        df['bb_l'] = df['bb_m'] = df['bb_u'] = None

    # ==========================================
    # 3. 핵심 로직: 동적 전략 적용 (Dynamic Strategy)
    # ==========================================
    
    # 사용자가 켠 전략 플래그 가져오기 (기본값 True/False 설정 주의)
    use_sma = params.get('enable_sma', True)
    use_rsi = params.get('enable_rsi', True)
    use_macd = params.get('enable_macd', False)
    use_bb = params.get('enable_bb', False)

    position = 0  # 0: 현금, 1: 보유
    signals = []

    for i in range(len(df)):
        # 데이터가 충분치 않은 초반 구간(NaN)은 패스
        if pd.isna(df['sma_l'].iloc[i]) or pd.isna(df['macd_s'].iloc[i]) or pd.isna(df['bb_u'].iloc[i]):
            signals.append(0)
            continue

        row = df.iloc[i]
        
        # 🟢 매수 검증 (Buy Validation)
        # 기본적으로 '매수 가능' 상태로 시작하고, 켜져 있는 지표들이 '반대'하면 매수 취소
        buy_vote = True  
        
        # 🔴 매도 검증 (Sell Trigger)
        # 켜져 있는 지표 중 하나라도 '팔아라' 하면 매도
        sell_vote = False 

        # --- [1] SMA 로직 ---
        if use_sma:
            # 단기가 장기보다 아래면 매수 금지 (역배열)
            if row['sma_s'] <= row['sma_l']: 
                buy_vote = False
            # 단기가 장기 아래로 뚫으면 매도 (데드크로스)
            if row['sma_s'] < row['sma_l']: 
                sell_vote = True

        # --- [2] RSI 로직 ---
        if use_rsi:
            # 과열 구간(예: 60이상)이면 매수 금지 (너무 비쌀 때 안 삼)
            if row['rsi'] >= params.get('rsi_buy_k', 60):
                buy_vote = False
            # (옵션) RSI가 너무 높으면(예: 80) 이익 실현 매도 로직 추가 가능

        # --- [3] MACD 로직 ---
        if use_macd:
            # MACD가 시그널 선 아래면 매수 금지 (하락 모멘텀)
            if row['macd'] <= row['macd_s']:
                buy_vote = False
            # 데드크로스(하향 돌파) 시 매도
            if row['macd'] < row['macd_s']:
                sell_vote = True

        # --- [4] Bollinger Bands 로직 ---
        if use_bb:
            # 가격이 밴드 상단을 뚫으면 '과매수'로 보고 매도 (이익 실현)
            if row['close'] > row['bb_u']:
                sell_vote = True
            # (옵션) 밴드 중심선보다 아래일 때만 저점 매수 하겠다... 등의 로직 가능
            # 여기서는 밴드 상단 돌파 시 매도 로직만 적용
        
        # 🛡️ 안전장치: 아무 전략도 안 켰으면 매매 안 함
        if not (use_sma or use_rsi or use_macd or use_bb):
            buy_vote = False
            sell_vote = False

        # --- 포지션 결정 ---
        if position == 0:
            if buy_vote:
                position = 1
        elif position == 1:
            if sell_vote:
                position = 0
        
        signals.append(position)

    # 길이 맞추기 (앞부분 NaN으로 스킵된 구간 0 채움)
    signals = [0] * (len(df) - len(signals)) + signals
    df['position'] = signals

    # 포지션 변화 감지 (1.0: 매수, -1.0: 매도)
    df['trade_signal'] = df['position'].diff()

    # ==========================================
    # 4. 수익률 계산 및 결과 포장
    # ==========================================
    df['pct_change'] = df['close'].pct_change().shift(-1)
    df['strategy_return'] = df['pct_change'] * df['position']
    df['cum_ret'] = (1 + df['strategy_return'].fillna(0)).cumprod()

    # UI 표시용 데이터 정제
    df['time_str'] = df['time'].dt.strftime('%Y-%m-%d')
    # 중복 제거 (하루에 데이터가 여러 개일 경우 마지막 값 사용)
    df_clean = df.drop_duplicates(subset=['time_str'], keep='last').copy()

    results = []
    for _, row in df_clean.iterrows():
        action = None
        if row['trade_signal'] == 1.0: action = 'buy'
        elif row['trade_signal'] == -1.0: action = 'sell'

        results.append({
            "time": row['time_str'],
            "value": round(float(row['cum_ret']), 4) if not pd.isna(row['cum_ret']) else 1.0,
            
            # 차트에 그릴 지표 데이터들 (NaN이면 None으로)
            "sma_s": round(float(row['sma_s']), 2) if not pd.isna(row['sma_s']) else None,
            "sma_l": round(float(row['sma_l']), 2) if not pd.isna(row['sma_l']) else None,
            "rsi": round(float(row['rsi']), 2) if not pd.isna(row['rsi']) else None,
            "macd": round(float(row['macd']), 2) if not pd.isna(row['macd']) else None,
            "macd_h": round(float(row['macd_h']), 2) if not pd.isna(row['macd_h']) else None,
            "bb_u": round(float(row['bb_u']), 2) if not pd.isna(row['bb_u']) else None,
            "bb_m": round(float(row['bb_m']), 2) if not pd.isna(row['bb_m']) else None,
            "bb_l": round(float(row['bb_l']), 2) if not pd.isna(row['bb_l']) else None,

            "action": action
        })

    final_return = 0.0
    if not df_clean.empty:
        final_return = round((df_clean['cum_ret'].iloc[-1] - 1) * 100, 2)

    return {
        "ticker": ticker,
        "results": results,
        "final_return": final_return
    }