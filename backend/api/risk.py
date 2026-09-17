"""Risk API contract for the frontend's map risk layers, location
drill-down, "Why Here?" driver panel, and Command Center summary.

Every response is either a direct RiskResult from the deterministic
baseline model (backend/risk/baseline_model.py) or a read of its
provenance/config/validation artifacts. No LLM involvement here.
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from backend.risk.baseline_model import get_risk
from backend.risk.contracts import RiskInput, RiskResult
from backend.risk.features import load_climate_feature_table, load_features_config
from backend.risk.provenance import load_climate_provenance

router = APIRouter(prefix="/risk", tags=["risk"])

REPO_ROOT = Path(__file__).resolve().parents[2]
VALIDATION_REPORT_PATH = REPO_ROOT / "data" / "processed" / "risk_validation_report.json"


@router.get("", response_model=RiskResult)
def risk_for_geo(
    geo_id: str = Query(..., description="district_id or mandal_id from the /gis layer"),
    food_category: str = Query(default="all_food"),
) -> RiskResult:
    try:
        return get_risk(RiskInput(geo_id=geo_id, food_category=food_category))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (KeyError, LookupError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/state")
def risk_state_summary(food_category: str = Query(default="all_food")) -> dict:
    table = load_climate_feature_table()
    results = []
    for district_id in table:
        try:
            results.append(get_risk(RiskInput(geo_id=district_id, food_category=food_category)))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    scored = [r for r in results if r.risk_score is not None]
    mean_score = round(sum(r.risk_score for r in scored) / len(scored), 4) if scored else None

    return {
        "food_scope": food_category,
        "district_count": len(results),
        "district_count_scored": len(scored),
        "mean_risk_score": mean_score,
        "truth_status": "DERIVED",
        "method": "Unweighted arithmetic mean of district risk_score values. Not population- or "
        "production-weighted -- no district-level population/production weighting data is ingested yet.",
        "districts": [r.model_dump() for r in results],
    }


@router.get("/config")
def risk_config() -> dict:
    return load_features_config()


@router.get("/provenance")
def risk_provenance() -> dict:
    return load_climate_provenance()


@router.get("/validation-report")
def risk_validation_report() -> dict:
    if not VALIDATION_REPORT_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No validation report yet -- run scripts/validate_risk_baseline.py",
        )
    return json.loads(VALIDATION_REPORT_PATH.read_text(encoding="utf-8"))
