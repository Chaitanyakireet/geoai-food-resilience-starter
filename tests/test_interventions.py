"""Hours 11-15 Shock Composer + Intervention Engine tests.

Covers: shock schema validation, deterministic shock transformation,
intervention schema, individual intervention effects, portfolio
composition, constraint handling, truth-status handling, provenance,
interaction assumptions, invalid inputs, and no-data behavior.
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
from backend.intervention.contracts import (
    Constraints,
    InterventionInput,
    PortfolioInput,
    ShockComposerInput,
)
from backend.intervention.engine import compute_intervention_effect
from backend.intervention.portfolio import compute_portfolio
from backend.intervention.shock_composer import build_shock_result

client = TestClient(app)

BASE_SHOCK = ShockInput(target_node_id="production_hyderabad", shock_type="production_reduction", severity=0.6)


# --- shock schema validation -------------------------------------------------


def test_shock_composer_requires_at_least_one_shock_field():
    with pytest.raises(ValidationError):
        ShockComposerInput(geo_id="hyderabad")


def test_shock_composer_accepts_a_single_field():
    inp = ShockComposerInput(geo_id="hyderabad", production_disruption=0.5)
    assert inp.production_disruption == 0.5


def test_shock_endpoint_rejects_empty_shock():
    resp = client.post("/interventions/shock", json={"geo_id": "hyderabad"})
    assert resp.status_code == 422


def test_shock_endpoint_unknown_geo_id_404s():
    resp = client.post("/interventions/shock", json={"geo_id": "not_a_real_place", "production_disruption": 0.5})
    assert resp.status_code == 404


# --- deterministic shock transformation --------------------------------------


def test_shock_result_is_deterministic():
    inp = ShockComposerInput(geo_id="hyderabad", heat_change_c=2.0, rainfall_change_pct=-0.3)
    result_a = build_shock_result(inp)
    result_b = build_shock_result(inp)
    assert result_a.shocked_risk.risk_score == result_b.shocked_risk.risk_score


def test_heat_and_rainfall_shock_increases_risk_score():
    inp = ShockComposerInput(geo_id="hyderabad", heat_change_c=3.0, rainfall_change_pct=-0.5)
    result = build_shock_result(inp)
    assert result.shocked_risk.risk_score > result.baseline_risk.risk_score
    assert result.shocked_risk.truth_status == "COUNTERFACTUAL"


def test_graph_only_shock_does_not_touch_risk():
    inp = ShockComposerInput(geo_id="hyderabad", production_disruption=0.7)
    result = build_shock_result(inp)
    assert result.baseline_risk is None
    assert result.shocked_risk is None
    assert len(result.graph_propagations) == 1


def test_shock_degrades_resilience_relative_to_baseline():
    inp = ShockComposerInput(geo_id="hyderabad", production_disruption=0.9, max_hops=5)
    result = build_shock_result(inp)
    assert result.shocked_resilience.current_resilience_score <= result.baseline_resilience.current_resilience_score


def test_multiple_graph_shock_fields_produce_multiple_propagations():
    inp = ShockComposerInput(geo_id="khammam", production_disruption=0.5, storage_capacity_reduction=0.4, transport_capacity_reduction=0.3)
    result = build_shock_result(inp)
    assert len(result.graph_propagations) == 3


# --- intervention schema -------------------------------------------------------


def test_intervention_input_requires_shock_and_type():
    with pytest.raises(ValidationError):
        InterventionInput(intervention_type="alternative_sourcing")  # missing shock


def test_intervention_endpoint_schema_validation():
    resp = client.post("/interventions/test", json={"intervention_type": "alternative_sourcing"})
    assert resp.status_code == 422


# --- individual intervention effects -------------------------------------------


def test_cataloged_intervention_uses_config_default_effectiveness():
    result = compute_intervention_effect(InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing"))
    assert result.effectiveness_source == "config_default"
    assert result.effectiveness_used == pytest.approx(0.35)


def test_effectiveness_override_takes_precedence():
    result = compute_intervention_effect(
        InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing", effectiveness_override=0.9)
    )
    assert result.effectiveness_source == "user_override"
    assert result.effectiveness_used == 0.9


def test_target_impact_reduction_matches_severity_times_effectiveness():
    result = compute_intervention_effect(InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing"))
    assert result.modeled_change.target_node_impact_reduction == pytest.approx(0.6 * 0.35, abs=1e-3)


def test_unknown_intervention_type_without_override_raises():
    with pytest.raises(ValueError):
        compute_intervention_effect(InterventionInput(shock=BASE_SHOCK, intervention_type="not_a_real_type"))


def test_unknown_intervention_type_with_override_is_accepted():
    result = compute_intervention_effect(
        InterventionInput(shock=BASE_SHOCK, intervention_type="custom_experimental_type", effectiveness_override=0.2)
    )
    assert result.effectiveness_used == 0.2
    assert result.effectiveness_source == "user_override"


def test_cost_water_carbon_are_echoed_not_invented():
    result = compute_intervention_effect(
        InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")
    )
    assert result.cost_estimate is None
    assert result.water_impact_m3 is None
    assert result.carbon_impact_tco2e is None

    result_with_values = compute_intervention_effect(
        InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing", cost_estimate=5000.0, water_impact_m3=10.0, carbon_impact_tco2e=2.0)
    )
    assert result_with_values.cost_estimate == 5000.0
    assert result_with_values.water_impact_m3 == 10.0
    assert result_with_values.carbon_impact_tco2e == 2.0


def test_mismatched_shock_type_still_computes_but_flags_limitation():
    result = compute_intervention_effect(
        InterventionInput(shock=BASE_SHOCK, intervention_type="route_diversification")  # applicable to transport, not production
    )
    assert any("not listed" in lim for lim in result.limitations)


# --- portfolio composition ------------------------------------------------------


def test_portfolio_requires_at_least_one_intervention():
    with pytest.raises(ValidationError):
        PortfolioInput(interventions=[])


def test_portfolio_combined_effect_exceeds_either_individual_effect_when_same_target():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")
    iv2 = InterventionInput(shock=BASE_SHOCK, intervention_type="resource_efficiency")
    single_1 = compute_intervention_effect(iv1)
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1, iv2]))
    assert portfolio.combined_food_availability_effect_proxy > single_1.modeled_change.food_availability_effect_proxy


def test_portfolio_uses_multiplicative_composition_not_linear_sum():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")  # 0.35
    iv2 = InterventionInput(shock=BASE_SHOCK, intervention_type="resource_efficiency")  # 0.15
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1, iv2]))

    # demand-node impact at severity s, 4 hops downstream, decay 0.6 per hop: s * 0.6**4
    def demand_impact(severity: float) -> float:
        return severity * (0.6**4)

    naive_linear_effectiveness = 0.35 + 0.15  # what a (wrong) linear-additive assumption would use
    naive_linear_reduction = demand_impact(0.6) - demand_impact(0.6 * (1 - naive_linear_effectiveness))
    assert portfolio.combined_food_availability_effect_proxy != pytest.approx(naive_linear_reduction, abs=1e-3)

    # multiplicative: combined_effectiveness = 1-(1-0.35)*(1-0.15) = 0.4475
    combined_effectiveness = 1 - 0.65 * 0.85
    expected_reduction = round(demand_impact(0.6) - demand_impact(0.6 * (1 - combined_effectiveness)), 4)
    assert portfolio.combined_food_availability_effect_proxy == pytest.approx(expected_reduction, abs=1e-3)


def test_portfolio_with_different_targets_has_no_combined_effect():
    other_shock = ShockInput(target_node_id="storage_khammam", shock_type="storage_capacity_reduction", severity=0.4)
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")
    iv2 = InterventionInput(shock=other_shock, intervention_type="storage_redistribution")
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1, iv2]))
    assert portfolio.combined_food_availability_effect_proxy is None
    assert any("different shocks" in lim for lim in portfolio.limitations)


def test_portfolio_result_contains_every_individual_intervention_result():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")
    iv2 = InterventionInput(shock=BASE_SHOCK, intervention_type="resource_efficiency")
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1, iv2]))
    assert len(portfolio.interventions) == 2


# --- constraint handling ----------------------------------------------------------


def test_constraints_absent_leaves_within_limit_none():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing", cost_estimate=1000.0)
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1]))
    assert portfolio.constraint_check["budget"].limit is None
    assert portfolio.constraint_check["budget"].within_limit is None
    assert portfolio.constraint_check["budget"].total == 1000.0


def test_budget_constraint_violation_detected():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing", cost_estimate=200000.0)
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1], constraints=Constraints(budget=100000.0)))
    assert portfolio.constraint_check["budget"].within_limit is False


def test_budget_constraint_satisfied():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing", cost_estimate=1000.0)
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1], constraints=Constraints(budget=100000.0)))
    assert portfolio.constraint_check["budget"].within_limit is True


def test_no_cost_supplied_leaves_total_none_not_zero():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1], constraints=Constraints(budget=100000.0)))
    assert portfolio.total_cost_estimate is None
    assert portfolio.constraint_check["budget"].within_limit is None  # cannot check against an unknown total


# --- truth-status handling ---------------------------------------------------------


def test_shock_result_truth_status_is_simulated():
    inp = ShockComposerInput(geo_id="hyderabad", production_disruption=0.5)
    result = build_shock_result(inp)
    assert result.truth_status == "SIMULATED"


def test_shocked_risk_is_counterfactual_not_observed_or_derived():
    inp = ShockComposerInput(geo_id="hyderabad", heat_change_c=1.5)
    result = build_shock_result(inp)
    assert result.shocked_risk.truth_status == "COUNTERFACTUAL"
    assert result.baseline_risk.truth_status != "COUNTERFACTUAL"


def test_intervention_and_portfolio_results_are_simulated():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")
    result = compute_intervention_effect(iv1)
    assert result.truth_status == "SIMULATED"
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1]))
    assert portfolio.truth_status == "SIMULATED"


# --- provenance --------------------------------------------------------------------


def test_provenance_endpoint_discloses_assumptions_not_fake_sources():
    resp = client.get("/interventions/provenance")
    assert resp.status_code == 200
    body = resp.json()
    assert "assumption_disclosure" in body
    assert "intervention_type_catalog" in body
    assert "upstream_provenance_endpoints" in body


def test_catalog_endpoint_lists_the_four_required_intervention_types():
    resp = client.get("/interventions/catalog")
    body = resp.json()
    required = {"alternative_sourcing", "storage_redistribution", "route_diversification", "resource_efficiency"}
    assert required <= set(body["intervention_types"].keys())


# --- interaction assumptions ---------------------------------------------------------


def test_portfolio_documents_independence_assumption():
    iv1 = InterventionInput(shock=BASE_SHOCK, intervention_type="alternative_sourcing")
    iv2 = InterventionInput(shock=BASE_SHOCK, intervention_type="resource_efficiency")
    portfolio = compute_portfolio(PortfolioInput(interventions=[iv1, iv2]))
    assert portfolio.combined_effect_composition_method == "multiplicative_independent"
    assert any("independent" in lim.lower() for lim in portfolio.limitations)


# --- invalid inputs / no-data behavior ------------------------------------------------


def test_intervention_test_unknown_target_node_404s():
    resp = client.post(
        "/interventions/test",
        json={"shock": {"target_node_id": "not_a_real_node", "shock_type": "production_reduction", "severity": 0.5}, "intervention_type": "alternative_sourcing"},
    )
    assert resp.status_code == 404


def test_intervention_test_unknown_type_without_override_400s():
    resp = client.post(
        "/interventions/test",
        json={"shock": {"target_node_id": "production_hyderabad", "shock_type": "production_reduction", "severity": 0.5}, "intervention_type": "not_a_real_type"},
    )
    assert resp.status_code == 400


def test_severity_out_of_range_rejected():
    with pytest.raises(ValidationError):
        ShockInput(target_node_id="production_hyderabad", shock_type="production_reduction", severity=1.5)


def test_portfolio_endpoint_empty_list_422s():
    resp = client.post("/interventions/portfolio", json={"interventions": []})
    assert resp.status_code == 422
