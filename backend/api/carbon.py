"""Food-System Carbon Impact Calculator API.

Deterministic activity x emissions-factor calculations (backend/carbon/) --
no LLM involvement. Exposes the factor registry, a single transport-carbon
calculation, and a baseline-vs-scenario comparison used by the Intervention
Lab and Digital Twin Compare Worlds panels.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.carbon.calculator import calculate_carbon_comparison, calculate_transport_carbon
from backend.carbon.contracts import (
    CarbonCalculationInput,
    CarbonCalculationResult,
    CarbonComparisonInput,
    CarbonComparisonResult,
    CarbonFactor,
)
from backend.carbon.registry import list_factors

router = APIRouter(prefix="/carbon", tags=["carbon"])


@router.get("/factors", response_model=list[CarbonFactor])
def get_factors() -> list[CarbonFactor]:
    return list_factors()


@router.post("/calculate", response_model=CarbonCalculationResult)
def post_calculate(inp: CarbonCalculationInput) -> CarbonCalculationResult:
    try:
        return calculate_transport_carbon(
            origin_geo_id=inp.origin_geo_id,
            destination_geo_id=inp.destination_geo_id,
            activity_tonnes=inp.activity_tonnes,
            factor_id=inp.factor_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/compare", response_model=CarbonComparisonResult)
def post_compare(inp: CarbonComparisonInput) -> CarbonComparisonResult:
    try:
        return calculate_carbon_comparison(
            geo_id=inp.geo_id,
            alternate_geo_id=inp.alternate_geo_id,
            activity_tonnes=inp.activity_tonnes,
            factor_id=inp.factor_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
