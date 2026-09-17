"""RiskInput -> RiskResult contract, matching docs/MASTER_HANDOFF.md section 11
(region_id, food_scope, horizon, risk_score, risk_class, confidence,
uncertainty_interval, major_drivers, data_coverage, model_version, run_id,
truth_status), plus provenance references and explicit spatial-resolution
tracking that the master contract doesn't specify but honesty requires."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]
RiskClass = Literal["low", "moderate", "high", "severe", "insufficient_data"]


class RiskInput(BaseModel):
    geo_id: str
    food_category: str = "all_food"


class Driver(BaseModel):
    feature: str
    observed_value: Optional[float]
    baseline_value: Optional[float]
    unit: str
    anomaly_pct: Optional[float]
    contribution_to_score: Optional[float]
    used_in_score: bool
    truth_status: TruthStatus
    note: Optional[str] = None


class DataCoverage(BaseModel):
    requested_days: int
    available_days: int
    coverage_ratio: float
    spatial_resolution: str


class RiskResult(BaseModel):
    region_id: str
    geo_level: Literal["district", "mandal", "state"]
    food_scope: str
    horizon: str = "current_conditions"
    date: str
    risk_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    risk_class: RiskClass
    confidence: Literal["low", "medium", "high"]
    uncertainty_interval: Optional[list[float]] = None
    major_drivers: list[Driver]
    data_coverage: DataCoverage
    model_version: str
    run_id: str
    truth_status: TruthStatus
    resolved_via: str
    provenance_refs: list[str]
    limitations: list[str]
