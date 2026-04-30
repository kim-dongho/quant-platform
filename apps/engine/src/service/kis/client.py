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


class KisClient:
    def __init__(self) -> None:
        self.mode = (os.getenv("KIS_MODE") or "paper").strip().lower()
        self.app_key = (os.getenv("KIS_APP_KEY") or "").strip()
        self.app_secret = (os.getenv("KIS_APP_SECRET") or "").strip()
        self.account_number = (os.getenv("KIS_ACCOUNT_NUMBER") or "").strip()
        self.account_product = (os.getenv("KIS_ACCOUNT_PRODUCT_CODE") or "01").strip()

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
        missing = [
            name
            for name, val in (
                ("KIS_APP_KEY", self.app_key),
                ("KIS_APP_SECRET", self.app_secret),
                ("KIS_ACCOUNT_NUMBER", self.account_number),
            )
            if not val
        ]
        if missing:
            raise KisError(f"KIS credentials missing: {', '.join(missing)}")

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
            if (
                not self._token
                or not self._token_expires
                or now >= self._token_expires
            ):
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
                "account": f"{self.account_number}-{self.account_product}",
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

        body = {
            "CANO": self.account_number,
            "ACNT_PRDT_CD": self.account_product,
            "PDNO": code,
            "ORD_DVSN": "01" if order_type == "market" else "00",
            "ORD_QTY": str(qty),
            "ORD_UNPR": "0" if order_type == "market" else str(int(price)),
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
            "INQR_DVSN": "00",         # 역순(최신부터)
            "PDNO": "",
            "CCLD_DVSN": "00",          # 전체(체결/미체결)
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


# 싱글톤 (env는 프로세스 수명 동안 고정이라 안전)
_client: Optional[KisClient] = None


def get_kis_client() -> KisClient:
    global _client
    if _client is None:
        _client = KisClient()
    return _client
