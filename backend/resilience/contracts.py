"""RESILIENCE is kept structurally separate from RISK (backend/risk):
RISK = likelihood/severity of disruption. RESILIENCE = modeled ability to
absorb, maintain, and recover. RESILIENCE_GAP = target - current. These are
never collapsed into a single number."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]


class ResilienceComponent(BaseModel):
    name: str
    value: float
    weight: float
    contribution: float
    note: str


class ResilienceResult(BaseModel):
    region_id: str
    geo_level: str
    food_scope: str
    current_resilience_score: float
    target_resilience_score: float
    resilience_gap: float
    components: list[ResilienceComponent]
    model_version: str
    truth_status: TruthStatus
    provenance_refs: list[str]
    limitations: list[str]
