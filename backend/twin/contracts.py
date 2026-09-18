"""TwinScenario -> TwinResult contract. Composes (does not modify)
backend/intervention (shock_composer, portfolio), backend/optimization,
backend/resilience, and backend/risk.

This is a deterministic scenario/decision-support simulation, not a live
operational digital twin and not a validated real-world recovery forecast.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, model_validator

from backend.graph.contracts import ShockInput
from backend.intervention.contracts import Constraints
from backend.optimization.contracts import CandidateIntervention

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]


class TwinScenario(BaseModel):
    scenario_id: str
    geo_id: str  # district_id, mandal_id, or "telangana" (state-level; baseline-only, see limitations)
    food_category: str = "all_food"

    # Shock configuration. None + no climate fields => pure baseline (Scenario A).
    shock: Optional[ShockInput] = None
    heat_change_c: Optional[float] = None
    rainfall_change_pct: Optional[float] = None

    # A caller-specified/manual portfolio to test directly (e.g. Scenario D, an alternative).
    intervention_portfolio: Optional[list[CandidateIntervention]] = None
    # A candidate pool to run through the Hours 15-18 optimizer (e.g. Scenario C, "selected/optimized").
    optimize_candidates: Optional[list[CandidateIntervention]] = None
    constraints: Optional[Constraints] = None
    objective_weights: Optional[dict[str, float]] = None

    simulation_horizon_days: Optional[int] = None  # falls back to config/twin.yaml default
    recovery_rate_override: Optional[float] = None  # ESTIMATED override of config/twin.yaml recovery_rate

    @model_validator(mode="after")
    def _interventions_require_a_shock(self):
        if (self.intervention_portfolio or self.optimize_candidates) and self.shock is None:
            raise ValueError("intervention_portfolio/optimize_candidates require a `shock` to test them against.")
        return self


class ScenarioState(BaseModel):
    label: str
    risk_score: Optional[float] = None
    risk_truth_status: Optional[TruthStatus] = None
    resilience_score: float
    resilience_gap: float
    demand_impact_fraction: float
    food_availability_effect_proxy: Optional[float] = None  # vs the no-intervention shocked state
    food_loss_effect: Optional[float] = None
    cost: Optional[float] = None
    water_impact_m3: Optional[float] = None
    carbon_impact_tco2e: Optional[float] = None
    intervention_types: list[str] = []
    truth_status: TruthStatus


class RecoveryPoint(BaseModel):
    day: int
    demand_impact_fraction: float
    resilience_score: float
    resilience_gap: float


class RecoveryTrajectory(BaseModel):
    starting_label: str  # which ScenarioState this trajectory recovers from
    points: list[RecoveryPoint]
    recovery_rate_used: float
    recovery_rate_source: Literal["config_default", "user_override"]
    timestep_days: int
    horizon_days: int
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    method: str
    limitations: list[str]


class RecoveryMetrics(BaseModel):
    peak_disruption: float
    final_disruption: float
    recovery_time_days: Optional[int]  # None if the threshold is never reached within the horizon
    recovery_fraction: float
    resilience_gap_before: float
    resilience_gap_after: float
    residual_impact: float
    definitions: dict[str, str]


class TwinResult(BaseModel):
    scenario_id: str
    geo_id: str
    geo_level: str
    food_category: str

    baseline_state: ScenarioState
    shocked_state: Optional[ScenarioState] = None
    intervention_state: Optional[ScenarioState] = None
    optimized_state: Optional[ScenarioState] = None

    shock_recovery: Optional[RecoveryTrajectory] = None
    intervention_recovery: Optional[RecoveryTrajectory] = None
    optimized_recovery: Optional[RecoveryTrajectory] = None

    shock_recovery_metrics: Optional[RecoveryMetrics] = None
    intervention_recovery_metrics: Optional[RecoveryMetrics] = None
    optimized_recovery_metrics: Optional[RecoveryMetrics] = None

    affected_geographies: list[str]
    affected_food_categories: list[str]
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    provenance_refs: list[str]
    limitations: list[str]


class CompareWorldsResult(BaseModel):
    scenario_id: str
    world_a_label: str  # no-intervention shock scenario
    world_b_label: str  # selected/optimized (or manual alternative) intervention scenario
    world_a_state: ScenarioState
    world_b_state: ScenarioState
    world_a_recovery: RecoveryTrajectory
    world_b_recovery: RecoveryTrajectory
    world_a_metrics: RecoveryMetrics
    world_b_metrics: RecoveryMetrics
    deltas: dict[str, Optional[float]]
    affected_geographies: list[str]
    affected_food_categories: list[str]
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    provenance_refs: list[str]
    limitations: list[str]
