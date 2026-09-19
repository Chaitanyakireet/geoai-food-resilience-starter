"""Food-system carbon calculator contracts.

Deterministic activity x emissions-factor calculation, entirely outside the
LLM. See config/carbon_factors.yaml for the factor registry and
backend/carbon/calculator.py for the arithmetic."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]


class CarbonFactor(BaseModel):
    factor_id: str
    activity_category: str
    status: Literal["available", "not_modeled"]
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    factor_value: Optional[float] = None
    unit: Optional[str] = None
    geography: Optional[str] = None
    year: Optional[int] = None
    methodology: Optional[str] = None
    uncertainty_limitations: Optional[str] = None


class CarbonCalculationInput(BaseModel):
    """origin_geo_id/destination_geo_id may be a district_id or mandal_id
    (mandal centroids are used directly, not inherited from the parent
    district, since distance is a geometric fact independent of the
    climate-grid-resolution reasoning that drives risk inheritance).
    activity_tonnes is an explicit, caller-supplied assumption -- this
    platform does not measure real freight tonnage."""

    origin_geo_id: str
    destination_geo_id: str
    activity_tonnes: Optional[float] = None
    factor_id: str = "road_freight_hgv_rigid_gt17t_avg_laden_uk_2021"


class CarbonCalculationResult(BaseModel):
    origin_geo_id: str
    destination_geo_id: str
    distance_km: Optional[float] = None
    distance_truth_status: Optional[TruthStatus] = None
    factor: CarbonFactor
    activity_tonnes: Optional[float] = None
    carbon_intensity_kg_per_tonne: Optional[float] = None
    total_carbon_kg: Optional[float] = None
    truth_status: TruthStatus
    available: bool
    unavailable_reason: Optional[str] = None
    limitations: list[str]


class WorldCarbon(BaseModel):
    """One side of a baseline-vs-scenario carbon comparison."""

    label: str
    total_carbon_kg: Optional[float] = None
    available: bool
    truth_status: TruthStatus
    unavailable_reason: Optional[str] = None


class CarbonComparisonInput(BaseModel):
    """World A (baseline/no intervention) vs World B (scenario/with
    intervention) framing, matching the Digital Twin's Compare Worlds and
    the Intervention Lab's baseline-vs-scenario pattern."""

    geo_id: str
    alternate_geo_id: Optional[str] = None
    activity_tonnes: Optional[float] = None
    factor_id: str = "road_freight_hgv_rigid_gt17t_avg_laden_uk_2021"


class CarbonComparisonResult(BaseModel):
    world_a: WorldCarbon
    world_b: WorldCarbon
    delta_carbon_kg: Optional[float] = None
    pct_change: Optional[float] = None
    detail: Optional[CarbonCalculationResult] = None
    limitations: list[str]
