"""
한국투자증권(KIS) Open API 경량 클라이언트.

- 토큰 자동 발급/캐싱 (24h TTL, 만료 5분 전 재발급)
- **토큰 파일 영속화** — 컨테이너 재시작에도 살아남음 (/app/data/kis_token_{mode}.json)
- **EGW00123 (만료 토큰) 자동 재시도** — 토큰 무효화 + 재발급 + 1회 재호출
- 모의투자/실전 URL·tr_id 자동 분기 (KIS_MODE=paper|real)
"""

from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, TypeVar

import requests


class KisError(Exception):
    """KIS API 호출 실패 또는 설정 오류."""


_PAPER_BASE_URL = "https://openapivts.koreainvestment.com:29443"
_REAL_BASE_URL = "https://openapi.koreainvestment.com:9443"

# 토큰 영속화 — 모드별 파일 분리. /app/data 는 docker-compose volume 매핑.
_TOKEN_DIR = os.getenv("KIS_TOKEN_DIR", "/app/data")

# rt_cd != "0" 응답 중 토큰 만료를 의미하는 코드. 발생 시 토큰 무효화 + 1회 재호출.
_TOKEN_EXPIRED_CODE = "EGW00123"

T = TypeVar("T")


def _normalize_krx_code(symbol: str) -> str:
    """'005930' / '005930.KS' / '005930.KQ' → '005930'. 6자리 숫자 외 입력은 에러."""
    code = symbol.strip().split(".")[0]
    if not re.match(r"^\d{6}$", code):
        raise KisError(f"Invalid KRX stock code: {symbol}")
    return code


def _krx_tick_size(price: float) -> int:
    """KRX 호가 단위 (2023.01.25 개편 기준 — KOSPI 표).

    매수/매도 주문가는 이 단위에 맞아야 KIS 가 받음 (APBK0506 회피).
    """
    p = int(price)
    if p < 2_000:
        return 1
    if p < 5_000:
        return 5
    if p < 20_000:
        return 10
    if p < 50_000:
        return 50
    if p < 200_000:
        return 100
    if p < 500_000:
        return 500
    return 1_000


def _floor_to_tick(price: float) -> int:
    """호가 단위로 내림. 매도 trigger/limit 둘 다 내림 = 약간 보수적인 가격."""
    tick = _krx_tick_size(price)
    return int(price // tick * tick)


def _env_for_mode(mode: str, suffix: str) -> str:
    """KIS_<MODE>_<SUFFIX> env 조회. 없으면 빈 문자열."""
    return os.getenv(f"KIS_{mode.upper()}_{suffix}", "").strip()


class KisClient:
    def __init__(self, mode: Optional[str] = None) -> None:
        # mode 인자 > KIS_MODE env > 'paper' 기본
        self.mode = (mode or os.getenv("KIS_MODE") or "paper").strip().lower()
        if self.mode not in ("paper", "real"):
            raise KisError(f"invalid mode: {self.mode}")

        # 모드 별 키만 사용 (KIS_PAPER_* / KIS_REAL_*).
        self.app_key = _env_for_mode(self.mode, "APP_KEY")
        self.app_secret = _env_for_mode(self.mode, "APP_SECRET")
        self.account_number = _env_for_mode(self.mode, "ACCOUNT_NUMBER")
        self.account_product = _env_for_mode(self.mode, "ACCOUNT_PRODUCT_CODE") or "01"

        self.base_url = _REAL_BASE_URL if self.mode == "real" else _PAPER_BASE_URL

        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None
        self._lock = threading.Lock()

        # 파일에 토큰 캐시가 있으면 로드 — 컨테이너 재시작에도 토큰 재사용.
        self._load_token_from_file()

    # ---------------------------------------------------------------------
    # Token 파일 영속화
    # ---------------------------------------------------------------------
    @property
    def _token_file(self) -> str:
        return os.path.join(_TOKEN_DIR, f"kis_token_{self.mode}.json")

    def _load_token_from_file(self) -> None:
        try:
            with open(self._token_file) as f:
                data = json.load(f)
            token = data.get("token")
            expires_iso = data.get("expires")
            if not token or not expires_iso:
                return
            expires = datetime.fromisoformat(expires_iso)
            if datetime.now(timezone.utc) >= expires:
                return  # 이미 만료
            self._token = token
            self._token_expires = expires
            print(f"🔑 KIS token loaded from cache (expires {expires.isoformat()})")
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"⚠️  KIS token cache load failed: {e}")

    def _save_token_to_file(self) -> None:
        if not self._token or not self._token_expires:
            return
        try:
            os.makedirs(_TOKEN_DIR, exist_ok=True)
            with open(self._token_file, "w") as f:
                json.dump(
                    {
                        "token": self._token,
                        "expires": self._token_expires.isoformat(),
                        "mode": self.mode,
                    },
                    f,
                )
            os.chmod(self._token_file, 0o600)  # 토큰은 비밀
        except Exception as e:
            print(f"⚠️  KIS token cache save failed: {e}")

    def _clear_token(self) -> None:
        """메모리 + 파일 캐시 모두 무효화."""
        with self._lock:
            self._token = None
            self._token_expires = None
        try:
            os.remove(self._token_file)
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"⚠️  KIS token cache clear failed: {e}")

    # ---------------------------------------------------------------------
    # Auth
    # ---------------------------------------------------------------------
    def _assert_configured(self) -> None:
        prefix = f"KIS_{self.mode.upper()}_"
        missing = [
            f"{prefix}{suffix}"
            for suffix, val in (
                ("APP_KEY", self.app_key),
                ("APP_SECRET", self.app_secret),
                ("ACCOUNT_NUMBER", self.account_number),
            )
            if not val
        ]
        if missing:
            raise KisError(f"KIS credentials missing ({self.mode}): {', '.join(missing)}")

    def _issue_token(self) -> str:
        resp = requests.post(
            f"{self.base_url}/oauth2/tokenP",
            json={
                "grant_type": "client_credentials",
                "appkey": self.app_key,
                "appsecret": self.app_secret,
            },
            timeout=10,
        )
        if resp.status_code != 200:
            raise KisError(f"Token issue failed: HTTP {resp.status_code} {resp.text}")

        data = resp.json()
        token = data.get("access_token")
        if not token:
            raise KisError(f"Token issue missing access_token: {data}")

        # expires_in 초(기본 86400) - 5분 여유 두고 재발급
        expires_in = int(data.get("expires_in", 86400))
        self._token = token
        self._token_expires = datetime.now(timezone.utc) + timedelta(seconds=expires_in - 300)
        print(f"🔑 KIS token issued (expires in {expires_in}s, mode={self.mode})")
        self._save_token_to_file()
        return token

    def _get_token(self) -> str:
        with self._lock:
            now = datetime.now(timezone.utc)
            if not self._token or not self._token_expires or now >= self._token_expires:
                return self._issue_token()
            return self._token

    def _auth_headers(self, tr_id: str) -> Dict[str, str]:
        return {
            "Content-Type": "application/json; charset=utf-8",
            "authorization": f"Bearer {self._get_token()}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": tr_id,
        }

    def _retry_on_token_expired(self, fn: Callable[[], T]) -> T:
        """fn() 실행 → EGW00123 (만료 토큰) 만나면 캐시 무효화 + 1회 재시도."""
        try:
            return fn()
        except KisError as e:
            if _TOKEN_EXPIRED_CODE not in str(e):
                raise
            print(f"⚠️  {_TOKEN_EXPIRED_CODE} — 토큰 캐시 무효화 후 재시도")
            self._clear_token()
            return fn()

    # ---------------------------------------------------------------------
    # 계좌/잔고
    # ---------------------------------------------------------------------
    def get_balance(self) -> Dict[str, Any]:
        """국내주식 잔고 조회 (inquire-balance)."""
        self._assert_configured()

        # tr_id: 실전 TTTC8434R, 모의 VTTC8434R
        tr_id = "TTTC8434R" if self.mode == "real" else "VTTC8434R"

        params = {
            "CANO": self.account_number,
            "ACNT_PRDT_CD": self.account_product,
            "AFHR_FLPR_YN": "N",
            "OFL_YN": "",
            "INQR_DVSN": "02",
            "UNPR_DVSN": "01",
            "FUND_STTL_ICLD_YN": "N",
            "FNCG_AMT_AUTO_RDPT_YN": "N",
            "PRCS_DVSN": "00",
            "CTX_AREA_FK100": "",
            "CTX_AREA_NK100": "",
        }

        def _do() -> Dict[str, Any]:
            resp = requests.get(
                f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-balance",
                headers=self._auth_headers(tr_id),
                params=params,
                timeout=15,
            )
            if resp.status_code != 200:
                raise KisError(f"Balance HTTP {resp.status_code}: {resp.text}")

            data = resp.json()
            if data.get("rt_cd") != "0":
                raise KisError(f"KIS {data.get('msg_cd')}: {data.get('msg1')}")

            # KIS 는 당일 매도 체결 후에도 평단가 정보 유지 목적으로 qty=0 row 를 응답에
            # 포함시킴. 보유 종목 의미가 없으므로 제외 (sync_with_holdings 와 일관).
            holdings = [
                {
                    "symbol": row.get("pdno"),
                    "name": row.get("prdt_name"),
                    "qty": int(row.get("hldg_qty") or 0),
                    "avg_cost": float(row.get("pchs_avg_pric") or 0),
                    "current_price": float(row.get("prpr") or 0),
                    "eval_amount": float(row.get("evlu_amt") or 0),
                    "profit": float(row.get("evlu_pfls_amt") or 0),
                    "profit_rate": float(row.get("evlu_pfls_rt") or 0),
                }
                for row in (data.get("output1") or [])
                if int(row.get("hldg_qty") or 0) > 0
            ]

            output2 = data.get("output2") or []
            summary_row = output2[0] if output2 else {}
            summary = {
                "total_eval": float(summary_row.get("tot_evlu_amt") or 0),
                "cash": float(summary_row.get("dnca_tot_amt") or 0),
                "deposit_d2": float(summary_row.get("prvs_rcdl_excc_amt") or 0),
                "total_profit": float(summary_row.get("evlu_pfls_smtl_amt") or 0),
            }

            return {
                "mode": self.mode,
                "holdings": holdings,
                "summary": summary,
            }

        return self._retry_on_token_expired(_do)

    # ---------------------------------------------------------------------
    # 시세
    # ---------------------------------------------------------------------
    def get_current_price(self, symbol: str) -> Dict[str, Any]:
        """국내주식 현재가 조회 (inquire-price) — 모의/실전 공통 tr_id."""
        self._assert_configured()
        code = _normalize_krx_code(symbol)

        def _do() -> Dict[str, Any]:
            resp = requests.get(
                f"{self.base_url}/uapi/domestic-stock/v1/quotations/inquire-price",
                headers=self._auth_headers("FHKST01010100"),
                params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": code},
                timeout=10,
            )
            if resp.status_code != 200:
                raise KisError(f"Quote HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            if data.get("rt_cd") != "0":
                raise KisError(f"KIS {data.get('msg_cd')}: {data.get('msg1')}")

            out = data.get("output") or {}
            return {
                "symbol": code,
                "price": float(out.get("stck_prpr") or 0),
                "open": float(out.get("stck_oprc") or 0),
                "high": float(out.get("stck_hgpr") or 0),
                "low": float(out.get("stck_lwpr") or 0),
                "prev_close": float(out.get("stck_sdpr") or 0),
                "change": float(out.get("prdy_vrss") or 0),
                "change_rate": float(out.get("prdy_ctrt") or 0),
                "volume": int(float(out.get("acml_vol") or 0)),
                # 종목 상태 코드 — 00=정상, 51=관리, 52=정리매매, 53=투자위험,
                # 54=투자경고, 55=매매정지, 56=투자주의. 매수 직전 체크용.
                "status_code": (out.get("iscd_stat_cls_code") or "").strip(),
            }

        return self._retry_on_token_expired(_do)

    # ---------------------------------------------------------------------
    # 주문
    # ---------------------------------------------------------------------
    def place_order(
        self,
        symbol: str,
        qty: int,
        side: str,
        order_type: str = "market",
        price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """현금 주문 (order-cash).
        side: 'buy' | 'sell'
        order_type: 'market' | 'limit'
        price: 지정가 주문일 때만 사용 (원 단위 정수).
        """
        self._assert_configured()
        if side not in ("buy", "sell"):
            raise KisError(f"Invalid side: {side}")
        if order_type not in ("market", "limit"):
            raise KisError(f"Invalid order_type: {order_type}")
        if qty <= 0:
            raise KisError(f"qty must be positive: {qty}")
        if order_type == "limit" and (price is None or price <= 0):
            raise KisError("price required for limit order")

        code = _normalize_krx_code(symbol)

        # tr_id: 실전 TTTC0802U(매수)/TTTC0801U(매도), 모의 VTTC0802U/VTTC0801U
        if self.mode == "real":
            tr_id = "TTTC0802U" if side == "buy" else "TTTC0801U"
        else:
            tr_id = "VTTC0802U" if side == "buy" else "VTTC0801U"

        # 지정가 주문은 KRX 호가 단위에 맞춰 내림 — APBK0506 회피.
        limit_price_int = _floor_to_tick(price) if order_type == "limit" else 0

        body = {
            "CANO": self.account_number,
            "ACNT_PRDT_CD": self.account_product,
            "PDNO": code,
            "ORD_DVSN": "01" if order_type == "market" else "00",
            "ORD_QTY": str(qty),
            "ORD_UNPR": "0" if order_type == "market" else str(limit_price_int),
        }

        def _do() -> Dict[str, Any]:
            resp = requests.post(
                f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash",
                headers=self._auth_headers(tr_id),
                json=body,
                timeout=15,
            )
            if resp.status_code != 200:
                raise KisError(f"Order HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            if data.get("rt_cd") != "0":
                raise KisError(f"KIS {data.get('msg_cd')}: {data.get('msg1')}")

            out = data.get("output") or {}
            return {
                "side": side,
                "symbol": code,
                "qty": qty,
                "order_type": order_type,
                "price": price,
                "order_no": out.get("ODNO"),
                "branch_no": out.get("KRX_FWDG_ORD_ORGNO"),
                "order_time": out.get("ORD_TMD"),
                "mode": self.mode,
            }

        return self._retry_on_token_expired(_do)

    # ---------------------------------------------------------------------
    # 스탑지정가 매도 주문 (ORD_DVSN=22) — KIS 서버가 정규장 시세 감시
    # ---------------------------------------------------------------------
    def place_stop_sell(
        self,
        symbol: str,
        qty: int,
        trigger_price: float,
        limit_price: float,
    ) -> Dict[str, Any]:
        """스탑지정가 매도 주문.

        - trigger_price (CNDT_PRIC): 현재가가 이 값 닿으면 발동
        - limit_price (ORD_UNPR): 발동 후 매도 지정가. 갭다운 미체결 방지 위해 trigger 보다
          1~3% 낮게 잡는 게 일반적.
        - 감시 시간: KRX 정규장 09:00~15:30. 시간외/야간 미작동, 다음 영업일 재개.
        """
        self._assert_configured()
        if qty <= 0:
            raise KisError(f"qty must be positive: {qty}")
        if trigger_price <= 0 or limit_price <= 0:
            raise KisError("trigger_price, limit_price required (>0)")

        code = _normalize_krx_code(symbol)
        # 매도 tr_id 그대로 사용 — ORD_DVSN=22 로 구분.
        tr_id = "TTTC0801U" if self.mode == "real" else "VTTC0801U"

        # KIS 는 호가 단위에 안 맞는 가격 거부 (APBK0506). 가격대별 tick 으로 내림.
        trigger_int = _floor_to_tick(trigger_price)
        limit_int = _floor_to_tick(limit_price)

        body = {
            "CANO": self.account_number,
            "ACNT_PRDT_CD": self.account_product,
            "PDNO": code,
            "ORD_DVSN": "22",
            "ORD_QTY": str(qty),
            "ORD_UNPR": str(limit_int),
            "CNDT_PRIC": str(trigger_int),
        }

        def _do() -> Dict[str, Any]:
            resp = requests.post(
                f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash",
                headers=self._auth_headers(tr_id),
                json=body,
                timeout=15,
            )
            if resp.status_code != 200:
                raise KisError(f"Stop order HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            if data.get("rt_cd") != "0":
                raise KisError(f"KIS {data.get('msg_cd')}: {data.get('msg1')}")
            out = data.get("output") or {}
            return {
                "symbol": code,
                "qty": qty,
                # 실제 KIS 에 보낸 정수 가격 반환 (호가 단위 정렬 후).
                "trigger_price": trigger_int,
                "limit_price": limit_int,
                "order_no": out.get("ODNO"),
                "branch_no": out.get("KRX_FWDG_ORD_ORGNO"),
                "order_time": out.get("ORD_TMD"),
                "mode": self.mode,
            }

        return self._retry_on_token_expired(_do)

    # ---------------------------------------------------------------------
    # 주문 취소 (order-rvsecncl, RVSE_CNCL_DVSN_CD=02)
    # ---------------------------------------------------------------------
    def cancel_order(
        self,
        branch_no: str,
        order_no: str,
        qty: int = 0,
    ) -> Dict[str, Any]:
        """기존 주문 취소. branch_no/order_no 는 place_order/place_stop_sell 응답값.

        qty=0 이면 전량 취소 (QTY_ALL_ORD_YN=Y). 부분 취소는 qty > 0.
        """
        self._assert_configured()
        if not branch_no or not order_no:
            raise KisError("branch_no, order_no required")

        tr_id = "TTTC0803U" if self.mode == "real" else "VTTC0803U"
        all_cancel = qty <= 0

        body = {
            "CANO": self.account_number,
            "ACNT_PRDT_CD": self.account_product,
            "KRX_FWDG_ORD_ORGNO": branch_no,
            "ORGN_ODNO": order_no,
            "ORD_DVSN": "00",
            "RVSE_CNCL_DVSN_CD": "02",
            "ORD_QTY": "0" if all_cancel else str(qty),
            "ORD_UNPR": "0",
            "QTY_ALL_ORD_YN": "Y" if all_cancel else "N",
        }

        def _do() -> Dict[str, Any]:
            resp = requests.post(
                f"{self.base_url}/uapi/domestic-stock/v1/trading/order-rvsecncl",
                headers=self._auth_headers(tr_id),
                json=body,
                timeout=15,
            )
            if resp.status_code != 200:
                raise KisError(f"Cancel HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            if data.get("rt_cd") != "0":
                raise KisError(f"KIS {data.get('msg_cd')}: {data.get('msg1')}")
            out = data.get("output") or {}
            return {
                "cancelled_order_no": order_no,
                "new_order_no": out.get("ODNO"),
                "mode": self.mode,
            }

        return self._retry_on_token_expired(_do)

    # ---------------------------------------------------------------------
    # 주문/체결 내역
    # ---------------------------------------------------------------------
    def get_daily_orders(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """일별 주문·체결 내역 (inquire-daily-ccld). start/end 생략 시 오늘."""
        self._assert_configured()
        today = datetime.now(timezone(timedelta(hours=9))).strftime("%Y%m%d")
        sdt = start_date or today
        edt = end_date or today

        # tr_id: 모의 VTTC8001R, 실전 TTTC8001R
        tr_id = "TTTC8001R" if self.mode == "real" else "VTTC8001R"

        params = {
            "CANO": self.account_number,
            "ACNT_PRDT_CD": self.account_product,
            "INQR_STRT_DT": sdt,
            "INQR_END_DT": edt,
            "SLL_BUY_DVSN_CD": "00",  # 전체
            "INQR_DVSN": "00",  # 역순(최신부터)
            "PDNO": "",
            "CCLD_DVSN": "00",  # 전체(체결/미체결)
            "ORD_GNO_BRNO": "",
            "ODNO": "",
            "INQR_DVSN_3": "00",
            "INQR_DVSN_1": "",
            "CTX_AREA_FK100": "",
            "CTX_AREA_NK100": "",
        }

        def _do() -> List[Dict[str, Any]]:
            resp = requests.get(
                f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-daily-ccld",
                headers=self._auth_headers(tr_id),
                params=params,
                timeout=15,
            )
            if resp.status_code != 200:
                raise KisError(f"Orders HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            if data.get("rt_cd") != "0":
                raise KisError(f"KIS {data.get('msg_cd')}: {data.get('msg1')}")

            rows = data.get("output1") or []
            results: List[Dict[str, Any]] = []
            for r in rows:
                ord_qty = int(r.get("ord_qty") or 0)
                ccld_qty = int(r.get("tot_ccld_qty") or 0)
                # status: 체결수량 >= 주문수량이면 filled, 0이면 pending, 나머진 partial
                if ccld_qty == 0:
                    status = "pending"
                elif ccld_qty >= ord_qty:
                    status = "filled"
                else:
                    status = "partial"
                side_code = r.get("sll_buy_dvsn_cd")  # 01=매도, 02=매수
                results.append(
                    {
                        "order_no": r.get("odno"),
                        "date": r.get("ord_dt"),
                        "time": r.get("ord_tmd"),
                        "symbol": r.get("pdno"),
                        "name": r.get("prdt_name"),
                        "side": "sell" if side_code == "01" else "buy",
                        "qty": ord_qty,
                        "price": float(r.get("ord_unpr") or 0),
                        "filled_qty": ccld_qty,
                        "filled_avg_price": float(r.get("avg_prvs") or 0),
                        "status": status,
                        "order_type": "market" if r.get("ord_dvsn_cd") == "01" else "limit",
                    }
                )
            return results

        return self._retry_on_token_expired(_do)


# 모드별 싱글톤 — paper/real 두 인스턴스 동시 운영 가능. env 는 프로세스 수명 동안 고정.
_clients: Dict[str, KisClient] = {}


def get_kis_client(mode: Optional[str] = None) -> KisClient:
    """mode='paper' / 'real' 별 KisClient 인스턴스. mode 미지정 시 KIS_MODE env 사용 (구 동작)."""
    resolved = (mode or os.getenv("KIS_MODE") or "paper").strip().lower()
    if resolved not in _clients:
        _clients[resolved] = KisClient(mode=resolved)
    return _clients[resolved]
