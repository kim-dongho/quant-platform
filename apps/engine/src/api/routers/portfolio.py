"""포트폴리오 스크리닝·백테스트·자동 탐색 라우터."""

from __future__ import annotations

import json
import threading
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import text

from src.api.deps import exit_policy_to_dict
from src.api.schemas import (
    DiscoverRequest,
    FactorPortfolioBacktestRequest,
    PortfolioBacktestRequest,
    ScreenRequest,
)
from src.core.database import engine
from src.service.backtest import (
    discover,
    factor_portfolio_backtest,
    run_portfolio_backtest,
)
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


@router.post("/factor-backtest")
def factor_portfolio_backtest_api(req: FactorPortfolioBacktestRequest):
    """랭킹 기반 펀더멘털 factor 포트폴리오 백테스트 (Phase 3 prototype)."""
    try:
        from datetime import date

        end = req.end_date or date.today().isoformat()
        return factor_portfolio_backtest(
            universe=req.universe,
            start=req.start_date,
            end=end,
            factor_dirs=req.factor_dirs,
            top_pct=req.top_pct,
            rebalance_months=req.rebalance_months,
            min_stocks=req.min_stocks,
        )
    except Exception as e:
        print(f"❌ Factor portfolio backtest failed: {e}")
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
                cancelled = bool(result.get("cancelled"))
                job["status"] = "cancelled" if cancelled else "done"
                job["result"] = result
                job["ended_at"] = time.time()
        # cancelled 가 아닌 정상 완료만 영구 저장 (불완전 결과는 노이즈).
        if not result.get("cancelled"):
            try:
                _save_discover_run(params, result)
            except Exception as e:
                print(f"⚠️  discover_runs insert failed (job {job_id}): {e}")
    except Exception as e:
        print(f"❌ Discover job {job_id} failed: {e}")
        with _DISCOVER_JOBS_LOCK:
            job = _DISCOVER_JOBS.get(job_id)
            if job is not None:
                job["status"] = "error"
                job["error"] = str(e)
                job["ended_at"] = time.time()


def _save_discover_run(params: Dict[str, Any], result: Dict[str, Any]) -> int:
    """완료된 discover 결과를 DB 에 누적 저장. 반환: 새 row id."""
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO discover_runs (universe, params, result)
                VALUES (:universe, CAST(:params AS JSONB), CAST(:result AS JSONB))
                RETURNING id
                """
            ),
            {
                "universe": params.get("universe", ""),
                "params": json.dumps(params, default=str),
                "result": json.dumps(result, default=str),
            },
        ).fetchone()
    return int(row[0]) if row else 0


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


# ─────────────────────────────────────────────────────────────
# discover 이력 — DB 영구 저장본 조회
# ─────────────────────────────────────────────────────────────
@router.get("/discover/runs")
def list_discover_runs(limit: int = 20, universe: Optional[str] = None):
    """최근 discover 실행 이력. result 통째는 무거우니 메타만 반환.

    반환: [{id, universe, params, created_at, top_summary}]
      top_summary: 결과의 1~3등 sharpe·cagr 만 미리보기로 (전체는 /result/:id).
    """
    limit = max(1, min(limit, 100))
    sql = """
        SELECT id, universe, params, created_at,
               jsonb_path_query_array(result, '$.all[0 to 2]') AS top_summary
        FROM discover_runs
        {where}
        ORDER BY created_at DESC
        LIMIT :lim
    """
    where = "WHERE universe = :u" if universe else ""
    params_: Dict[str, Any] = {"lim": limit}
    if universe:
        params_["u"] = universe
    with engine.connect() as conn:
        rows = conn.execute(text(sql.format(where=where)), params_).all()
    return [
        {
            "id": r[0],
            "universe": r[1],
            "params": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "top_summary": r[4] or [],
        }
        for r in rows
    ]


@router.get("/discover/runs/{run_id}")
def get_discover_run(run_id: int):
    """단일 discover 결과 상세 — params + result 통째 (UI 화면 복원용)."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, universe, params, result, created_at
                FROM discover_runs WHERE id = :id
                """
            ),
            {"id": run_id},
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Discover run not found")
    return {
        "id": row[0],
        "universe": row[1],
        "params": row[2],
        "result": row[3],
        "created_at": row[4].isoformat() if row[4] else None,
    }


@router.delete("/discover/runs/{run_id}")
def delete_discover_run(run_id: int):
    with engine.begin() as conn:
        res = conn.execute(text("DELETE FROM discover_runs WHERE id = :id"), {"id": run_id})
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Discover run not found")
    return {"deleted": run_id}
