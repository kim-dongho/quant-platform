"""포트폴리오 스크리닝·백테스트·자동 탐색 라우터."""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException

from src.api.deps import exit_policy_to_dict
from src.api.schemas import DiscoverRequest, PortfolioBacktestRequest, ScreenRequest
from src.service.backtest import discover, run_portfolio_backtest
from src.service.factor import ScreenError, run_screen

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("/screen")
def screen_portfolio(req: ScreenRequest):
    try:
        return run_screen(
            universe=req.universe,
            clauses=[c.model_dump() for c in req.clauses],
            max_positions=req.max_positions,
            as_of=req.as_of,
        )
    except ScreenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Screen failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backtest")
def portfolio_backtest_api(req: PortfolioBacktestRequest):
    try:
        return run_portfolio_backtest(
            universe=req.universe,
            clauses=[c.model_dump() for c in req.clauses],
            max_positions=req.max_positions,
            start_date=req.start_date,
            end_date=req.end_date,
            exit_policy=exit_policy_to_dict(req.exit_policy),
        )
    except ScreenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Portfolio backtest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/discover")
def discover_portfolio_api(req: DiscoverRequest):
    """동기 grid search — 백워드 호환용. progress가 필요하면 /discover/start 사용."""
    try:
        return discover(
            universe=req.universe,
            factors=req.factors,
            ops=req.ops,
            percentiles=req.percentiles,
            start_date=req.start_date,
            end_date=req.end_date,
            train_ratio=req.train_ratio,
            max_positions=req.max_positions,
            n_clauses=req.n_clauses,
            top_n=req.top_n,
            exit_policy=exit_policy_to_dict(req.exit_policy),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Discover failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# 비동기 discover — background thread + polling
# ─────────────────────────────────────────────────────────────
_DISCOVER_JOBS: Dict[str, Dict[str, Any]] = {}
_DISCOVER_JOBS_LOCK = threading.Lock()
_DISCOVER_JOB_TTL_SECONDS = 30 * 60


def _gc_old_discover_jobs() -> None:
    now = time.time()
    with _DISCOVER_JOBS_LOCK:
        stale = [
            jid
            for jid, job in _DISCOVER_JOBS.items()
            if job.get("status") in ("done", "error")
            and now - job.get("ended_at", now) > _DISCOVER_JOB_TTL_SECONDS
        ]
        for jid in stale:
            del _DISCOVER_JOBS[jid]


def _run_discover_job(job_id: str, params: Dict[str, Any]) -> None:
    def progress(done: int, total: int, label: str) -> None:
        with _DISCOVER_JOBS_LOCK:
            job = _DISCOVER_JOBS.get(job_id)
            if job is not None:
                job["done"] = done
                job["total"] = total
                job["current"] = label

    def should_cancel() -> bool:
        with _DISCOVER_JOBS_LOCK:
            job = _DISCOVER_JOBS.get(job_id)
            return bool(job and job.get("cancel_requested"))

    try:
        result = discover(progress_cb=progress, should_cancel=should_cancel, **params)
        with _DISCOVER_JOBS_LOCK:
            job = _DISCOVER_JOBS.get(job_id)
            if job is not None:
                # 사용자 cancel 요청으로 끝났으면 status=cancelled, 아니면 done.
                job["status"] = "cancelled" if result.get("cancelled") else "done"
                job["result"] = result
                job["ended_at"] = time.time()
    except Exception as e:
        print(f"❌ Discover job {job_id} failed: {e}")
        with _DISCOVER_JOBS_LOCK:
            job = _DISCOVER_JOBS.get(job_id)
            if job is not None:
                job["status"] = "error"
                job["error"] = str(e)
                job["ended_at"] = time.time()


@router.post("/discover/start")
def discover_start(req: DiscoverRequest, background: BackgroundTasks):
    """비동기 grid search 시작. job_id 반환 → /status/:id로 진행률 polling."""
    _gc_old_discover_jobs()
    job_id = uuid.uuid4().hex
    params = {
        "universe": req.universe,
        "factors": req.factors,
        "ops": req.ops,
        "percentiles": req.percentiles,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "train_ratio": req.train_ratio,
        "max_positions": req.max_positions,
        "n_clauses": req.n_clauses,
        "top_n": req.top_n,
        "exit_policy": exit_policy_to_dict(req.exit_policy),
    }
    with _DISCOVER_JOBS_LOCK:
        _DISCOVER_JOBS[job_id] = {
            "status": "running",
            "done": 0,
            "total": 0,
            "current": "",
            "started_at": time.time(),
        }
    background.add_task(_run_discover_job, job_id, params)
    return {"job_id": job_id}


@router.get("/discover/status/{job_id}")
def discover_status(job_id: str):
    with _DISCOVER_JOBS_LOCK:
        job = _DISCOVER_JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found or expired")
        return dict(job)


@router.post("/discover/cancel/{job_id}")
def discover_cancel(job_id: str):
    """진행 중인 grid search 취소. loop 가 다음 iter 진입 시 멈출 때까지 짧게 대기 후
    최종 status (보통 cancelled) 와 부분 결과를 즉시 반환 — 클라이언트는 polling
    1초 더 기다릴 필요 없이 바로 화면 갱신.
    """
    with _DISCOVER_JOBS_LOCK:
        job = _DISCOVER_JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found or expired")
        if job.get("status") not in ("running", None):
            return dict(job)
        job["cancel_requested"] = True

    # loop 가 status 를 cancelled/done 으로 바꿀 때까지 polling. 매 iter 가
    # ~수백 ms 라 보통 1초 안에 끝남. 5초 timeout.
    for _ in range(50):
        time.sleep(0.1)
        with _DISCOVER_JOBS_LOCK:
            j = _DISCOVER_JOBS.get(job_id)
            if j and j.get("status") in ("cancelled", "done", "error"):
                return dict(j)
    # timeout — 클라이언트는 polling 으로 마저 받음
    return {"job_id": job_id, "status": "cancelling"}
