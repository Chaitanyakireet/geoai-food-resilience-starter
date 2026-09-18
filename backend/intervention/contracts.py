"""Shock Composer + Intervention/Portfolio contracts.

Reuses backend.graph.contracts.ShockInput/PropagationResult and
backend.risk/resilience results rather than redefining them -- this module
composes those existing engines, it does not replace them.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, model_validator

from backend.graph.contracts import PropagationResult, ShockInput
from backend.resilience.contracts import ResilienceResult
from backend.risk.contracts import RiskResult

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]


# --- Shock Composer ---------------------------------------------------------


class ShockComposerInput(BaseModel):
    geo_id: str
    food_category: str = "all_food"
    start_date: Optional[str] = None
    duration_days: Optional[int] = None
    heat_change_c: Optional[float] = None
    rainfall_change_pct: Optional[float] = None  # fractional, e.g. -0.3 = 30% less rainfall
    transport_capacity_reduction: Optional[float] = None  # 0.0-1.0
    storage_capacity_reduction: Optional[float] = None  # 0.0-1.0
    production_disruption: Optional[float] = None  # 0.0-1.0
    market_demand_disruption: Optional[float] = None  # 0.0-1.0
    max_hops: int = 5

    @model_validator(mode="after")
    def _at_least_one_shock_field(self):
        fields = [
            self.heat_change_c,
            self.rainfall_change_pct,
            self.transport_capacity_reduction,
            self.storage_capacity_reduction,
            self.production_disruption,
            self.market_demand_disruption,
        ]
        if all(f is None for f in fields):
            raise ValueError("At least one shock field must be set (heat_change_c, rainfall_change_pct, "
                              "transport_capacity_reduction, storage_capacity_reduction, production_disruption, "
                              "or market_demand_disruption).")
        return self


class ShockResult(BaseModel):
    shock_input: ShockComposerInput
    geo_id: str
    food_category: str
    baseline_risk: Optional[RiskResult] = None
    shocked_risk: Optional[RiskResult] = None  # COUNTERFACTUAL, only present if heat/rainfall fields given
    baseline_resilience: ResilienceResult
    shocked_resilience: ResilienceResult
    graph_propagations: list[PropagationResult]
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    provenance_refs: list[str]
    limitations: list[str]


# --- Intervention ------------------------------------------------------------


class InterventionInput(BaseModel):
    shock: ShockInput
    intervention_type: str
    effectiveness_override: Optional[float] = None  # 0.0-1.0; required if intervention_type is not in the catalog
    cost_estimate: Optional[float] = None
    cost_note: Optional[str] = None
    water_impact_m3: Optional[float] = None
    carbon_impact_tco2e: Optional[float] = None
    loss_reduction_pct: Optional[float] = None  # 0.0-1.0, user assumption
    assumption_note: Optional[str] = None


class ModeledChange(BaseModel):
    target_node_impact_reduction: float
    food_availability_effect_proxy: float
    resilience_effect: float
    note: str


class InterventionResult(BaseModel):
    intervention_type: str
    intervention_label: str
    mechanism: str
    affected_geo_id: str
    affected_food_categories: list[str]
    effectiveness_used: float
    effectiveness_source: Literal["config_default", "user_override"]
    baseline_resilience: ResilienceResult
    shock_propagation: PropagationResult
    shock_resilience: ResilienceResult
    intervention_propagation: PropagationResult
    intervention_resilience: ResilienceResult
    modeled_change: ModeledChange
    food_loss_effect: Optional[float] = None
    water_impact_m3: Optional[float] = None
    carbon_impact_tco2e: Optional[float] = None
    cost_estimate: Optional[float] = None
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    provenance_refs: list[str]
    limitations: list[str]


# --- Portfolio -----------------------------------------------------------------


class Constraints(BaseModel):
    budget: Optional[float] = None
    water_limit_m3: Optional[float] = None
    carbon_target_tco2e: Optional[float] = None


class PortfolioInput(BaseModel):
    interventions: list[InterventionInput]
    constraints: Optional[Constraints] = None

    @model_validator(mode="after")
    def _at_least_one_intervention(self):
        if not self.interventions:
            raise ValueError("A portfolio must contain at least one intervention.")
        return self


class ConstraintCheckEntry(BaseModel):
    limit: Optional[float]
    total: Optional[float]
    within_limit: Optional[bool]  # None when limit or total is unknown -- never guessed


class PortfolioResult(BaseModel):
    interventions: list[InterventionResult]
    combined_effect_composition_method: str
    # Reduction in modeled impact_fraction at the shared target's geography's demand
    # node (mirrors food_availability_effect_proxy per-intervention) -- only computed
    # when every intervention targets the same shock; None otherwise.
    combined_food_availability_effect_proxy: Optional[float] = None
    total_cost_estimate: Optional[float] = None
    total_water_impact_m3: Optional[float] = None
    total_carbon_impact_tco2e: Optional[float] = None
    constraint_check: dict[str, ConstraintCheckEntry]
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    provenance_refs: list[str]
    limitations: list[str]
