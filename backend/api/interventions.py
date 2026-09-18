"""Shock Composer + Intervention/Portfolio API. Composes the existing risk,
graph, and resilience engines (all unmodified) into a decision layer for
the future frontend, Hours 15-18 optimizer, and Digital Twin.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.intervention.catalog import load_interventions_config
from backend.intervention.contracts import (
    InterventionInput,
    InterventionResult,
    PortfolioInput,
    PortfolioResult,
    ShockComposerInput,
    ShockResult,
)
from backend.intervention.engine import compute_intervention_effect
from backend.intervention.portfolio import compute_portfolio
from backend.intervention.provenance import build_intervention_provenance
from backend.intervention.shock_composer import build_shock_result

router = APIRouter(prefix="/interventions", tags=["interventions"])


@router.post("/shock", response_model=ShockResult)
def post_shock(inp: ShockComposerInput) -> ShockResult:
    try:
        return build_shock_result(inp)
    except (KeyError, LookupError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/test", response_model=InterventionResult)
def post_test(inp: InterventionInput) -> InterventionResult:
    try:
        return compute_intervention_effect(inp)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/portfolio", response_model=PortfolioResult)
def post_portfolio(inp: PortfolioInput) -> PortfolioResult:
    try:
        return compute_portfolio(inp)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/catalog")
def get_catalog() -> dict:
    return load_interventions_config()


@router.get("/provenance")
def get_provenance() -> dict:
    return build_intervention_provenance()
