"""진입 룰 → 청산 룰 자동 도출 (Hysteresis / asymmetric thresholds).

업계 정통 기법. 진입은 까다롭게(예: RSI > 66) / 청산은 buffer 둔 약한 임계값
(예: RSI < 51) 으로 잡아 시그널이 임계값 근처에서 진동할 때 발생하는 whipsaw 매매를
줄인다. Mean reversion 의 1.0σ 진입 / 0.5σ 청산 패턴과 같은 개념.

이 모듈은 사용자가 청산 룰을 직접 작성하지 않아도 진입 룰에서 합리적인 buffer 를
자동 계산해 채워준다. 사용자가 직접 작성한 signal_exit_clauses 가 있으면 그걸
우선 사용한다 (executor 쪽에서 처리).
"""
from __future__ import annotations

from typing import Any, Dict, List


def derive_signal_exit_clauses(entry_clauses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """진입 룰을 OR 결합 청산 룰로 변환. 한 진입 절이 깨지면 매도.

    factor 별 buffer 규칙:
      - rsi_14 > X     → rsi_14 < max(50, X - 15)     (과매수 해소)
      - rsi_14 < X     → rsi_14 > min(50, X + 15)     (과매도 회복)
      - price_vs_smaN > X (양수)  → price_vs_smaN < 0  (장기 추세 깨짐)
      - price_vs_smaN < X (음수)  → price_vs_smaN > 0  (반등 확인)
      - vol_ratio_20d > X         → vol_ratio_20d < 1.0  (거래량 정상화)
      - return_5d > X             → return_5d < 0      (단기 모멘텀 사라짐)
      - return_5d < X             → return_5d > 0
      - sma20_vs_sma50 > 0        → sma20_vs_sma50 < 0  (데드 크로스)
      - sma20_vs_sma50 < 0        → sma20_vs_sma50 > 0  (골든 크로스)
      - 기타 — 부등호만 뒤집은 mirror clause
    """
    out: List[Dict[str, Any]] = []
    for c in entry_clauses:
        factor = c.get("factor")
        op = c.get("op")
        value = c.get("value")
        if factor is None or op is None or value is None:
            continue
        derived = _derive_one(factor, op, float(value))
        if derived:
            out.append(derived)
    return out


def _derive_one(factor: str, op: str, value: float) -> Dict[str, Any] | None:
    # RSI — 50 을 중심으로 15 buffer 둔 반대 조건
    if factor == "rsi_14":
        if op in (">", ">="):
            exit_value = max(50.0, value - 15.0)
            return {"factor": factor, "op": "<", "value": round(exit_value, 4)}
        if op in ("<", "<="):
            exit_value = min(50.0, value + 15.0)
            return {"factor": factor, "op": ">", "value": round(exit_value, 4)}

    # price_vs_smaN — 0 (= sma 선) 으로 추세 깨짐 판정
    if factor.startswith("price_vs_sma"):
        if op in (">", ">="):
            return {"factor": factor, "op": "<", "value": 0.0}
        if op in ("<", "<="):
            return {"factor": factor, "op": ">", "value": 0.0}

    # vol_ratio_20d — 평균(1.0) 으로 정상화 판정
    if factor == "vol_ratio_20d":
        if op in (">", ">="):
            return {"factor": factor, "op": "<", "value": 1.0}
        if op in ("<", "<="):
            return {"factor": factor, "op": ">", "value": 1.0}

    # return_5d — 0 (수익률 마이너스 전환) 으로 모멘텀 소진 판정
    if factor == "return_5d":
        if op in (">", ">="):
            return {"factor": factor, "op": "<", "value": 0.0}
        if op in ("<", "<="):
            return {"factor": factor, "op": ">", "value": 0.0}

    # sma20_vs_sma50 — 0 (이평선 교차) 로 추세 전환 판정
    if factor == "sma20_vs_sma50":
        if op in (">", ">="):
            return {"factor": factor, "op": "<", "value": 0.0}
        if op in ("<", "<="):
            return {"factor": factor, "op": ">", "value": 0.0}

    # fallback — 부등호만 뒤집은 mirror clause (의미는 약함)
    mirror = {">": "<", ">=": "<=", "<": ">", "<=": ">="}
    if op in mirror:
        return {"factor": factor, "op": mirror[op], "value": value}
    return None


def evaluate_signal_exit(factor_row: Dict[str, Any], clauses: List[Dict[str, Any]]) -> bool:
    """단일 종목의 오늘 factor 행에 대해 OR 결합 평가. 하나라도 맞으면 청산."""
    for c in clauses:
        col, op, val = c.get("factor"), c.get("op"), c.get("value")
        if col is None or op is None or val is None:
            continue
        x = factor_row.get(col)
        if x is None:
            continue
        try:
            xv = float(x)
            v = float(val)
        except (TypeError, ValueError):
            continue
        if op == "<" and xv < v:
            return True
        if op == "<=" and xv <= v:
            return True
        if op == ">" and xv > v:
            return True
        if op == ">=" and xv >= v:
            return True
        if op == "=" and xv == v:
            return True
        if op == "!=" and xv != v:
            return True
    return False
