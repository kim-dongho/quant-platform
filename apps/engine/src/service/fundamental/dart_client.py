"""
DART (전자공시) Open API 클라이언트 — 얇은 wrapper.

API 문서: https://opendart.fss.or.kr/guide/main.do
응답 필드 한글로 와서 파싱 시 영어 enum 매핑 필요.

호출 두 종류:
  1) corpCode.xml      — 전체 상장사 corp_code 매핑 (ZIP 응답)
  2) fnlttSinglAcntAll — 단일 회사 분기 재무제표 (JSON, 125개 항목)

⚠️ rate limit
  키 1개당 일 40,000 회. 200 종목 × 24 분기 = 4,800 회 — 12% 사용.
  per-second 한도는 없어서 sleep 없이도 되지만 0.05s 박아 안전 마진.
"""

from __future__ import annotations

import io
import os
import time
import zipfile
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree as ET

import requests

DART_BASE = "https://opendart.fss.or.kr/api"
_DEFAULT_TIMEOUT = 15
_CALL_INTERVAL_SEC = 0.05


def _api_key() -> str:
    k = os.getenv("DART_API_KEY", "").strip()
    if not k:
        raise RuntimeError("DART_API_KEY 미설정 — .env 에 키 등록 후 docker compose up -d engine")
    return k


# ---------------------------------------------------------------------------
# 1. 회사 코드 매핑
# ---------------------------------------------------------------------------
def fetch_corp_code_list() -> List[Dict[str, str]]:
    """전체 상장사 corp_code 목록 다운로드 (ZIP/XML 파싱).

    반환: [{corp_code, corp_name, stock_code, modify_date}, ...]
    stock_code 가 비어있는 row 는 비상장사 (제외 권장).
    """
    r = requests.get(
        f"{DART_BASE}/corpCode.xml",
        params={"crtfc_key": _api_key()},
        timeout=60,  # 3.5MB 다운로드 — 여유 timeout
    )
    r.raise_for_status()

    # ZIP 안에 CORPCODE.xml 1개. 메모리에서 풀고 즉시 파싱.
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        names = z.namelist()
        if not names:
            raise RuntimeError("corpCode ZIP 비어있음")
        with z.open(names[0]) as f:
            tree = ET.parse(f)

    out: List[Dict[str, str]] = []
    for el in tree.getroot().findall("list"):
        out.append(
            {
                "corp_code": (el.findtext("corp_code") or "").strip(),
                "corp_name": (el.findtext("corp_name") or "").strip(),
                "stock_code": (el.findtext("stock_code") or "").strip(),
                "modify_date": (el.findtext("modify_date") or "").strip(),
            }
        )
    return out


# ---------------------------------------------------------------------------
# 2. 단일 회사 재무제표
# ---------------------------------------------------------------------------
# DART reprt_code 매핑 — 분기별 보고서 종류
REPORT_CODES = {
    "Q1": "11013",  # 1분기보고서
    "Q2": "11012",  # 반기보고서
    "Q3": "11014",  # 3분기보고서
    "Q4": "11011",  # 사업보고서
}


def fetch_financial_statement(
    corp_code: str,
    year: int,
    quarter: str,  # "Q1" | "Q2" | "Q3" | "Q4"
    fs_div: str = "OFS",  # OFS=별도(개별), CFS=연결
) -> Optional[List[Dict[str, Any]]]:
    """단일 회사·분기 재무제표 조회. 결과 없으면 None.

    fs_div:
      - OFS (별도): 단일 법인 기준 — 작은 회사 / 지배구조 단순한 곳
      - CFS (연결): 자회사 포함 — 대기업·지주사
      삼성전자 같은 대기업은 CFS 가 더 정확하지만 첫 시도는 OFS 로 (응답이 더 많음).
    """
    if quarter not in REPORT_CODES:
        raise ValueError(f"quarter must be Q1/Q2/Q3/Q4, got {quarter}")

    time.sleep(_CALL_INTERVAL_SEC)
    r = requests.get(
        f"{DART_BASE}/fnlttSinglAcntAll.json",
        params={
            "crtfc_key": _api_key(),
            "corp_code": corp_code,
            "bsns_year": str(year),
            "reprt_code": REPORT_CODES[quarter],
            "fs_div": fs_div,
        },
        timeout=_DEFAULT_TIMEOUT,
    )
    r.raise_for_status()
    data = r.json()

    status = data.get("status")
    # status 000=정상, 013=조회 데이터 없음 (해당 분기 미보고 등)
    if status == "013":
        return None
    if status != "000":
        # 그 외는 예외 (key 오류, rate limit 등)
        raise RuntimeError(f"DART error status={status} message={data.get('message')}")
    return data.get("list", [])


# ---------------------------------------------------------------------------
# 3. 응답 파싱 — 핵심 6 field 추출
# ---------------------------------------------------------------------------
# DART account_nm 은 회사마다 약간씩 다름 (예: '매출액' vs '수익(매출액)',
# 또는 '당기순이익' vs '연결분기순이익'). 다양한 표기를 모두 잡도록 후보 리스트로 매칭.
#
# ⚠️ 분기 손익항목 의미
#   분기보고서 (Q1·Q3) thstrm_amount = 해당 분기 단독 (Q3 → Jul-Sep만)
#   반기보고서 (Q2)    thstrm_amount = 상반기 누적 (Jan-Jun)
#   사업보고서 (Q4)    thstrm_amount = 연간 누적 (Jan-Dec)
#   factor 계산에서 ROE TTM 같은 게 필요하면 Q4(연간) 값을 그대로 쓰면 됨.
ACCOUNT_ALIASES = {
    "revenue": ["매출액", "수익(매출액)", "수익", "영업수익", "매출"],
    "operating_income": ["영업이익", "영업이익(손실)"],
    "net_income": [
        "당기순이익",
        "당기순이익(손실)",
        "분기순이익",
        "분기순이익(손실)",
        "반기순이익",
        "반기순이익(손실)",
        "연결분기순이익",
        "연결반기순이익",
        "연결당기순이익",
    ],
    "total_assets": ["자산총계"],
    "total_equity": ["자본총계"],
    "total_liabilities": ["부채총계"],
    "eps_basic": [
        "보통주기본주당이익(손실)",
        "보통주기본주당이익",
        "기본주당이익",
        "기본주당이익(손실)",
        "기본주당순이익",
        "기본주당순이익(손실)",
    ],
}


def _to_int(s: Any) -> Optional[int]:
    """DART thstrm_amount 는 string ('312083288000000' 또는 '-' / 빈문자열)."""
    if s is None:
        return None
    s = str(s).strip().replace(",", "")
    if not s or s == "-":
        return None
    try:
        return int(s)
    except (ValueError, TypeError):
        return None


def parse_financials(items: List[Dict[str, Any]]) -> Dict[str, Optional[int]]:
    """API 응답 list → {revenue, operating_income, ...} dict.

    동일 account_nm 이 재무상태표·손익계산서 양쪽에 있을 수 있어 sj_div 로도 구분.
    """
    out: Dict[str, Optional[int]] = {k: None for k in ACCOUNT_ALIASES}
    if not items:
        return out

    for it in items:
        acc = (it.get("account_nm") or "").strip()
        sj = it.get("sj_div") or ""  # BS=재무상태표, IS/CIS=손익계산서
        amount = _to_int(it.get("thstrm_amount"))

        for key, aliases in ACCOUNT_ALIASES.items():
            if out[key] is not None:
                continue  # 이미 채움
            if acc not in aliases:
                continue
            # 재무상태표 / 손익계산서 매칭 보강
            if key in ("total_assets", "total_equity", "total_liabilities") and sj != "BS":
                continue
            if key in ("revenue", "operating_income", "net_income", "eps_basic") and sj not in (
                "IS",
                "CIS",
            ):
                continue
            out[key] = amount
    return out
