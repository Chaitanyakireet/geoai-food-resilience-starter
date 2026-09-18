"""Multi-objective portfolio optimizer API. The /optimization/run response
itself carries the full candidate/Pareto set (not just the selection),
serving the future Intervention Lab / Compare Worlds UI without needing a
separate stateful endpoint.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.optimization.config import load_optimization_config
from backend.optimization.contracts import OptimizationInput, OptimizationResult
from backend.optimization.optimizer import run_optimization
from backend.optimization.provenance import build_optimization_provenance

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.post("/run", response_model=OptimizationResult)
def post_run(inp: OptimizationInput) -> OptimizationResult:
    try:
        return run_optimization(inp)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/config")
def get_config() -> dict:
    return load_optimization_config()


@router.get("/provenance")
def get_provenance() -> dict:
    return build_optimization_provenance()
