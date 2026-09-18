"""Digital Twin API: scenario runs, Compare Worlds, scenario catalog,
config, and provenance. Composes the existing risk/graph/intervention/
optimization/resilience engines (all unmodified) with a new deterministic
recovery model.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.twin.compare import compare_worlds
from backend.twin.config import load_twin_config
from backend.twin.contracts import CompareWorldsResult, TwinResult, TwinScenario
from backend.twin.engine import run_twin_scenario
from backend.twin.provenance import build_twin_provenance
from backend.twin.scenarios import get_scenario_catalog

router = APIRouter(prefix="/twin", tags=["twin"])


@router.post("/run", response_model=TwinResult)
def post_run(scenario: TwinScenario) -> TwinResult:
    try:
        return run_twin_scenario(scenario)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/compare", response_model=CompareWorldsResult)
def post_compare(scenario: TwinScenario) -> CompareWorldsResult:
    try:
        return compare_worlds(scenario)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/scenarios")
def get_scenarios() -> dict:
    return get_scenario_catalog()


@router.get("/config")
def get_config() -> dict:
    return load_twin_config()


@router.get("/provenance")
def get_provenance() -> dict:
    return build_twin_provenance()
