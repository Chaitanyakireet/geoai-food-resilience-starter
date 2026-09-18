"""OptimizationInput -> OptimizationResult contract. Composes (does not
modify) backend/intervention's InterventionInput/PortfolioResult and
backend/graph's ShockInput."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, model_validator

from backend.graph.contracts import ShockInput
from backend.intervention.contracts import Constraints, PortfolioResult

TruthStatus = Literal["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"]
FeasibilityStatus = Literal["feasible", "infeasible", "unconstrained"]


class CandidateIntervention(BaseModel):
    """An InterventionInput without `shock` -- the optimizer applies the
    single OptimizationInput.shock to every candidate so combinations are
    directly comparable."""

    intervention_type: str
    effectiveness_override: Optional[float] = None
    cost_estimate: Optional[float] = None
    cost_note: Optional[str] = None
    water_impact_m3: Optional[float] = None
    carbon_impact_tco2e: Optional[float] = None
    loss_reduction_pct: Optional[float] = None
    assumption_note: Optional[str] = None


class OptimizationInput(BaseModel):
    shock: ShockInput
    candidate_interventions: list[CandidateIntervention]
    constraints: Optional[Constraints] = None
    objective_weights: Optional[dict[str, float]] = None  # overrides config/optimization.yaml if given

    @model_validator(mode="after")
    def _at_least_one_candidate(self):
        if not self.candidate_interventions:
            raise ValueError("candidate_interventions must contain at least one candidate intervention.")
        return self


class ObjectiveValues(BaseModel):
    food_availability_effect_proxy: Optional[float] = None
    resilience_effect: Optional[float] = None
    food_loss_effect: Optional[float] = None
    cost: Optional[float] = None
    water_impact_m3: Optional[float] = None
    carbon_impact_tco2e: Optional[float] = None


class PortfolioCandidate(BaseModel):
    intervention_types: list[str]
    portfolio: PortfolioResult
    objective_values: ObjectiveValues
    feasibility_status: FeasibilityStatus
    feasibility_note: str
    normalized_score: Optional[float] = None  # None if infeasible (never ranked/selected)
    is_pareto_optimal: bool


class BaselineState(BaseModel):
    """The 'do nothing' reference point: shock applied, zero interventions."""

    risk_score: Optional[float] = None
    risk_truth_status: Optional[TruthStatus] = None
    resilience_score: float
    resilience_gap: float
    demand_impact_fraction: float  # modeled shock impact at the affected geography's demand node
    truth_status: TruthStatus = "SIMULATED"


class OptimizationExplanation(BaseModel):
    selected_intervention_types: list[str]
    why_feasible: str
    binding_constraints: list[str]
    objectives_improved: list[str]
    objectives_worsened: list[str]
    assumptions_influencing_result: list[str]


class OptimizationResult(BaseModel):
    objective_weights_used: dict[str, float]
    normalization_method: str
    baseline_state: BaselineState
    candidates: list[PortfolioCandidate]
    feasible_candidate_count: int
    infeasible_candidate_count: int
    selected_candidate: Optional[PortfolioCandidate] = None
    explanation: Optional[OptimizationExplanation] = None
    truth_status: Literal["SIMULATED"] = "SIMULATED"
    provenance_refs: list[str]
    limitations: list[str]
