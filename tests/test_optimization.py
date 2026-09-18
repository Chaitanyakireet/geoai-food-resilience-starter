"""Hours 15-18 multi-objective optimizer tests.

Covers: feasible/infeasible/unconstrained portfolios, budget/water/carbon
constraints, multi-objective comparison, baseline comparison, deterministic
repeatability, empty candidate set, invalid intervention inputs, and
truth-status/provenance propagation.
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.graph.contracts import ShockInput
from backend.intervention.contracts import Constraints
from backend.optimization.contracts import CandidateIntervention, OptimizationInput
from backend.optimization.optimizer import run_optimization

client = TestClient(app)

BASE_SHOCK = ShockInput(target_node_id="production_hyderabad", shock_type="production_reduction", severity=0.7)

CHEAP_CANDIDATE = CandidateIntervention(intervention_type="resource_efficiency", cost_estimate=20000, water_impact_m3=50, carbon_impact_tco2e=1)
MID_CANDIDATE = CandidateIntervention(intervention_type="storage_redistribution", cost_estimate=40000, water_impact_m3=100, carbon_impact_tco2e=3)
EXPENSIVE_CANDIDATE = CandidateIntervention(intervention_type="alternative_sourcing", cost_estimate=60000, water_impact_m3=200, carbon_impact_tco2e=5)


def _run(constraints=None, candidates=None, weights=None):
    return run_optimization(
        OptimizationInput(
            shock=BASE_SHOCK,
            candidate_interventions=candidates or [CHEAP_CANDIDATE, MID_CANDIDATE, EXPENSIVE_CANDIDATE],
            constraints=constraints,
            objective_weights=weights,
        )
    )


# --- unconstrained case -------------------------------------------------------


def test_unconstrained_run_marks_every_candidate_unconstrained():
    result = _run(constraints=None)
    assert result.feasible_candidate_count == len(result.candidates)
    assert result.infeasible_candidate_count == 0
    assert all(c.feasibility_status == "unconstrained" for c in result.candidates)


def test_unconstrained_run_still_selects_a_candidate():
    result = _run(constraints=None)
    assert result.selected_candidate is not None


# --- feasible / infeasible portfolio --------------------------------------------


def test_generous_budget_makes_all_candidates_feasible():
    result = _run(constraints=Constraints(budget=1_000_000))
    assert result.infeasible_candidate_count == 0
    assert all(c.feasibility_status == "feasible" for c in result.candidates)


def test_tight_budget_produces_some_infeasible_candidates():
    result = _run(constraints=Constraints(budget=25000))
    assert result.infeasible_candidate_count > 0
    infeasible = [c for c in result.candidates if c.feasibility_status == "infeasible"]
    assert all("budget" in c.feasibility_note.lower() or "Violates" in c.feasibility_note for c in infeasible)


def test_selected_candidate_is_never_infeasible():
    result = _run(constraints=Constraints(budget=25000))
    assert result.selected_candidate is not None
    assert result.selected_candidate.feasibility_status != "infeasible"


def test_impossibly_tight_budget_yields_no_selection():
    result = _run(constraints=Constraints(budget=1))
    assert result.feasible_candidate_count == 0
    assert result.selected_candidate is None
    assert result.explanation.selected_intervention_types == []
    assert "no candidate portfolio satisfied" in result.explanation.why_feasible.lower()


# --- budget / water / carbon constraints, independently ------------------------


def test_budget_constraint_alone():
    result = _run(constraints=Constraints(budget=45000))
    single_expensive = next(c for c in result.candidates if c.intervention_types == ["alternative_sourcing"])
    assert single_expensive.feasibility_status == "infeasible"


def test_water_constraint_alone():
    result = _run(constraints=Constraints(water_limit_m3=60))
    single_expensive = next(c for c in result.candidates if c.intervention_types == ["alternative_sourcing"])
    assert single_expensive.feasibility_status == "infeasible"
    single_cheap = next(c for c in result.candidates if c.intervention_types == ["resource_efficiency"])
    assert single_cheap.feasibility_status == "feasible"


def test_carbon_constraint_alone():
    result = _run(constraints=Constraints(carbon_target_tco2e=2))
    single_expensive = next(c for c in result.candidates if c.intervention_types == ["alternative_sourcing"])
    assert single_expensive.feasibility_status == "infeasible"
    single_cheap = next(c for c in result.candidates if c.intervention_types == ["resource_efficiency"])
    assert single_cheap.feasibility_status == "feasible"


# --- multi-objective comparison -------------------------------------------------


def test_every_candidate_exposes_raw_unweighted_objective_values():
    result = _run(constraints=None)
    for c in result.candidates:
        assert c.objective_values.food_availability_effect_proxy is not None
        assert c.objective_values.resilience_effect is not None


def test_pareto_optimal_flag_is_present_and_not_all_true():
    result = _run(constraints=None)
    assert any(c.is_pareto_optimal for c in result.candidates)
    # with a strictly dominated combo in the mix (small+cheap should dominate large+expensive
    # somewhere in this candidate set), not everything should be marked Pareto-optimal.
    assert not all(c.is_pareto_optimal for c in result.candidates)


def test_objective_weights_influence_selection():
    cost_focused = _run(
        constraints=None,
        weights={"food_availability_effect_proxy": 0.0, "resilience_effect": 0.0, "food_loss_effect": 0.0, "cost": 1.0, "water_impact_m3": 0.0, "carbon_impact_tco2e": 0.0},
    )
    # minimizing cost above all else should select the single cheapest candidate
    assert cost_focused.selected_candidate.intervention_types == ["resource_efficiency"]


def test_objective_weights_used_are_reported():
    result = _run(constraints=None)
    assert set(result.objective_weights_used.keys()) >= {"food_availability_effect_proxy", "resilience_effect", "cost"}


# --- baseline comparison --------------------------------------------------------


def test_baseline_state_reflects_shock_with_no_intervention():
    result = _run(constraints=None)
    assert result.baseline_state.demand_impact_fraction > 0
    assert result.baseline_state.resilience_gap is not None
    assert result.baseline_state.risk_score is not None


def test_selected_candidate_improves_on_baseline_food_availability():
    result = _run(constraints=None)
    assert result.selected_candidate.objective_values.food_availability_effect_proxy > 0


# --- deterministic repeatability -------------------------------------------------


def test_optimization_is_deterministic():
    result_a = _run(constraints=Constraints(budget=90000))
    result_b = _run(constraints=Constraints(budget=90000))
    assert result_a.selected_candidate.intervention_types == result_b.selected_candidate.intervention_types
    assert result_a.selected_candidate.normalized_score == result_b.selected_candidate.normalized_score
    assert [c.feasibility_status for c in result_a.candidates] == [c.feasibility_status for c in result_b.candidates]


# --- empty candidate set ----------------------------------------------------------


def test_empty_candidate_set_rejected_by_schema():
    with pytest.raises(ValidationError):
        OptimizationInput(shock=BASE_SHOCK, candidate_interventions=[])


def test_optimization_run_endpoint_rejects_empty_candidates():
    resp = client.post("/optimization/run", json={"shock": BASE_SHOCK.model_dump(), "candidate_interventions": []})
    assert resp.status_code == 422


# --- invalid intervention inputs --------------------------------------------------


def test_unknown_intervention_type_without_override_is_skipped_not_crashed():
    bad_candidate = CandidateIntervention(intervention_type="not_a_real_type")
    result = _run(candidates=[CHEAP_CANDIDATE, bad_candidate], constraints=None)
    # the bad combo(s) should be skipped and noted, not raise -- good candidates still evaluated
    assert any(c.intervention_types == ["resource_efficiency"] for c in result.candidates)
    assert any("Skipped candidate combination" in lim for lim in result.limitations)


def test_unknown_target_node_404s():
    with pytest.raises(KeyError):
        run_optimization(
            OptimizationInput(
                shock=ShockInput(target_node_id="not_a_real_node", shock_type="production_reduction", severity=0.5),
                candidate_interventions=[CHEAP_CANDIDATE],
            )
        )


def test_optimization_run_endpoint_404_for_unknown_node():
    resp = client.post(
        "/optimization/run",
        json={
            "shock": {"target_node_id": "not_a_real_node", "shock_type": "production_reduction", "severity": 0.5},
            "candidate_interventions": [{"intervention_type": "resource_efficiency"}],
        },
    )
    assert resp.status_code == 404


# --- truth-status propagation ------------------------------------------------------


def test_optimization_result_truth_status_is_simulated():
    result = _run(constraints=None)
    assert result.truth_status == "SIMULATED"
    assert result.baseline_state.truth_status == "SIMULATED"


def test_candidate_portfolios_retain_simulated_truth_status():
    result = _run(constraints=None)
    for c in result.candidates:
        assert c.portfolio.truth_status == "SIMULATED"


# --- provenance propagation ---------------------------------------------------------


def test_provenance_refs_include_upstream_layers():
    result = _run(constraints=None)
    assert any("intervention" in ref for ref in result.provenance_refs)
    assert any("graph" in ref for ref in result.provenance_refs)
    assert any("risk" in ref for ref in result.provenance_refs)


def test_optimization_provenance_endpoint():
    resp = client.get("/optimization/provenance")
    assert resp.status_code == 200
    body = resp.json()
    assert "assumption_disclosure" in body
    assert "objective_weights_default" in body
    assert set(body["upstream_provenance_endpoints"]) >= {"/interventions/provenance", "/graph/provenance", "/risk/provenance"}


def test_optimization_config_endpoint():
    resp = client.get("/optimization/config")
    assert resp.status_code == 200
    body = resp.json()
    assert "objective_weights" in body
    assert "max_candidates" in body


# --- API end-to-end ------------------------------------------------------------------


def test_run_endpoint_end_to_end():
    resp = client.post(
        "/optimization/run",
        json={
            "shock": BASE_SHOCK.model_dump(),
            "candidate_interventions": [CHEAP_CANDIDATE.model_dump(), MID_CANDIDATE.model_dump()],
            "constraints": {"budget": 90000},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["selected_candidate"] is not None
    assert len(body["candidates"]) == 3  # 2^2 - 1 non-empty subsets
