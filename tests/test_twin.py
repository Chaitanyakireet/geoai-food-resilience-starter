"""Hours 18-21 Digital Twin + recovery tests.

Covers: baseline/shock/intervention/optimized scenarios, recovery
trajectory/metrics, deterministic repeatability, time-step generation,
Compare Worlds, spatial linkage, truth-status/provenance/uncertainty
propagation, and invalid scenario handling.
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
from backend.optimization.contracts import CandidateIntervention
from backend.twin.compare import compare_worlds
from backend.twin.contracts import TwinScenario
from backend.twin.engine import run_twin_scenario

client = TestClient(app)

SHOCK = ShockInput(target_node_id="production_hyderabad", shock_type="production_reduction", severity=0.7)
CHEAP = CandidateIntervention(intervention_type="resource_efficiency", cost_estimate=20000, water_impact_m3=50, carbon_impact_tco2e=1)
EXPENSIVE = CandidateIntervention(intervention_type="alternative_sourcing", cost_estimate=60000, water_impact_m3=200, carbon_impact_tco2e=5)


# --- Scenario A: baseline ----------------------------------------------------


def test_baseline_scenario_has_no_shocked_state():
    result = run_twin_scenario(TwinScenario(scenario_id="A", geo_id="hyderabad"))
    assert result.shocked_state is None
    assert result.intervention_state is None
    assert result.shock_recovery is None
    assert result.baseline_state.demand_impact_fraction == 0.0


def test_baseline_scenario_state_level():
    result = run_twin_scenario(TwinScenario(scenario_id="A_state", geo_id="telangana"))
    assert result.geo_level == "state"
    assert result.baseline_state.resilience_score is not None


def test_state_level_shock_rejected():
    with pytest.raises(ValueError):
        run_twin_scenario(TwinScenario(scenario_id="bad", geo_id="telangana", shock=SHOCK))


# --- Scenario B: shock, no intervention --------------------------------------


def test_shock_scenario_has_shocked_state_and_no_intervention_state():
    result = run_twin_scenario(TwinScenario(scenario_id="B", geo_id="hyderabad", shock=SHOCK))
    assert result.shocked_state is not None
    assert result.shocked_state.demand_impact_fraction > 0
    assert result.intervention_state is None
    assert result.optimized_state is None


def test_shock_scenario_with_climate_fields_produces_counterfactual_risk():
    result = run_twin_scenario(TwinScenario(scenario_id="B2", geo_id="hyderabad", shock=SHOCK, heat_change_c=2.0))
    assert result.shocked_state.risk_truth_status == "COUNTERFACTUAL"
    assert result.shocked_state.risk_score > result.baseline_state.risk_score


def test_shock_scenario_without_climate_fields_keeps_baseline_risk():
    result = run_twin_scenario(TwinScenario(scenario_id="B3", geo_id="hyderabad", shock=SHOCK))
    assert result.shocked_state.risk_score == result.baseline_state.risk_score
    assert result.shocked_state.risk_truth_status != "COUNTERFACTUAL"


def test_pure_climate_shock_without_graph_target():
    result = run_twin_scenario(TwinScenario(scenario_id="B4", geo_id="hyderabad", heat_change_c=3.0, rainfall_change_pct=-0.4))
    assert result.shocked_state.demand_impact_fraction == 0.0  # no graph shock -> no graph propagation impact
    assert result.shocked_state.risk_truth_status == "COUNTERFACTUAL"


# --- Scenario C: shock + optimized intervention ------------------------------


def test_optimized_scenario_populates_optimized_state():
    result = run_twin_scenario(
        TwinScenario(scenario_id="C", geo_id="hyderabad", shock=SHOCK, optimize_candidates=[CHEAP, EXPENSIVE], constraints=Constraints(budget=90000))
    )
    assert result.optimized_state is not None
    assert result.optimized_state.demand_impact_fraction < result.shocked_state.demand_impact_fraction
    assert result.optimized_recovery is not None
    assert result.optimized_recovery_metrics is not None


def test_optimized_scenario_no_feasible_portfolio_leaves_state_none():
    result = run_twin_scenario(
        TwinScenario(scenario_id="C2", geo_id="hyderabad", shock=SHOCK, optimize_candidates=[EXPENSIVE], constraints=Constraints(budget=1))
    )
    assert result.optimized_state is None
    assert any("no feasible portfolio" in lim.lower() for lim in result.limitations)


def test_intervention_state_requires_a_shock():
    with pytest.raises(ValidationError):
        TwinScenario(scenario_id="bad", geo_id="hyderabad", intervention_portfolio=[CHEAP])


# --- intervention scenario (Scenario D, manual portfolio) ---------------------


def test_manual_intervention_portfolio_populates_intervention_state():
    result = run_twin_scenario(TwinScenario(scenario_id="D", geo_id="hyderabad", shock=SHOCK, intervention_portfolio=[CHEAP]))
    assert result.intervention_state is not None
    assert result.intervention_state.intervention_types == ["resource_efficiency"]
    assert result.intervention_recovery is not None


def test_both_manual_and_optimized_in_one_scenario():
    result = run_twin_scenario(
        TwinScenario(
            scenario_id="CD",
            geo_id="hyderabad",
            shock=SHOCK,
            intervention_portfolio=[CHEAP],
            optimize_candidates=[CHEAP, EXPENSIVE],
            constraints=Constraints(budget=90000),
        )
    )
    assert result.intervention_state is not None
    assert result.optimized_state is not None
    # optimizer can combine both candidates -> should do at least as well as the single manual one
    assert result.optimized_state.demand_impact_fraction <= result.intervention_state.demand_impact_fraction


# --- recovery trajectory / time-step generation -------------------------------


def test_recovery_trajectory_covers_the_full_horizon():
    result = run_twin_scenario(TwinScenario(scenario_id="rt", geo_id="hyderabad", shock=SHOCK, simulation_horizon_days=30))
    days = [p.day for p in result.shock_recovery.points]
    assert days[0] == 0
    assert days[-1] == 30
    assert days == sorted(days)


def test_recovery_timestep_spacing_matches_config():
    result = run_twin_scenario(TwinScenario(scenario_id="rt2", geo_id="hyderabad", shock=SHOCK, simulation_horizon_days=21))
    assert result.shock_recovery.timestep_days == 7
    days = [p.day for p in result.shock_recovery.points]
    assert days == [0, 7, 14, 21]


def test_recovery_impact_decreases_monotonically():
    result = run_twin_scenario(TwinScenario(scenario_id="rt3", geo_id="hyderabad", shock=SHOCK))
    impacts = [p.demand_impact_fraction for p in result.shock_recovery.points]
    assert impacts == sorted(impacts, reverse=True)


def test_recovery_rate_override_changes_trajectory():
    slow = run_twin_scenario(TwinScenario(scenario_id="slow", geo_id="hyderabad", shock=SHOCK, recovery_rate_override=0.01))
    fast = run_twin_scenario(TwinScenario(scenario_id="fast", geo_id="hyderabad", shock=SHOCK, recovery_rate_override=0.5))
    assert slow.shock_recovery.points[-1].demand_impact_fraction > fast.shock_recovery.points[-1].demand_impact_fraction
    assert slow.shock_recovery.recovery_rate_source == "user_override"


# --- recovery metrics ----------------------------------------------------------


def test_recovery_metrics_definitions_present_for_every_metric():
    result = run_twin_scenario(TwinScenario(scenario_id="rm", geo_id="hyderabad", shock=SHOCK))
    metrics = result.shock_recovery_metrics
    for field in ["peak_disruption", "final_disruption", "recovery_time_days", "recovery_fraction", "resilience_gap_before", "resilience_gap_after", "residual_impact"]:
        assert field in metrics.definitions


def test_peak_disruption_equals_initial_impact():
    result = run_twin_scenario(TwinScenario(scenario_id="rm2", geo_id="hyderabad", shock=SHOCK))
    assert result.shock_recovery_metrics.peak_disruption == result.shocked_state.demand_impact_fraction


def test_recovery_time_none_when_threshold_never_reached():
    result = run_twin_scenario(TwinScenario(scenario_id="rm3", geo_id="hyderabad", shock=SHOCK, simulation_horizon_days=1, recovery_rate_override=0.001))
    assert result.shock_recovery_metrics.recovery_time_days is None


# --- deterministic repeatability -----------------------------------------------


def test_twin_run_is_deterministic():
    scenario = TwinScenario(scenario_id="det", geo_id="hyderabad", shock=SHOCK, optimize_candidates=[CHEAP, EXPENSIVE], constraints=Constraints(budget=90000))
    result_a = run_twin_scenario(scenario)
    result_b = run_twin_scenario(scenario)
    assert result_a.shocked_state.demand_impact_fraction == result_b.shocked_state.demand_impact_fraction
    assert result_a.optimized_state.demand_impact_fraction == result_b.optimized_state.demand_impact_fraction
    assert [p.demand_impact_fraction for p in result_a.shock_recovery.points] == [p.demand_impact_fraction for p in result_b.shock_recovery.points]


# --- Compare Worlds --------------------------------------------------------------


def test_compare_worlds_end_to_end():
    scenario = TwinScenario(scenario_id="cw", geo_id="hyderabad", shock=SHOCK, optimize_candidates=[CHEAP, EXPENSIVE], constraints=Constraints(budget=90000))
    result = compare_worlds(scenario)
    assert result.world_a_label == "shock_no_intervention"
    assert result.world_b_label == "optimized_intervention"
    assert result.world_b_state.demand_impact_fraction < result.world_a_state.demand_impact_fraction
    assert result.deltas["demand_impact_fraction"] < 0  # improvement


def test_compare_worlds_requires_shock():
    with pytest.raises(ValueError):
        compare_worlds(TwinScenario(scenario_id="cw2", geo_id="hyderabad"))


def test_compare_worlds_requires_an_intervention():
    with pytest.raises(ValueError):
        compare_worlds(TwinScenario(scenario_id="cw3", geo_id="hyderabad", shock=SHOCK))


def test_compare_worlds_falls_back_to_manual_portfolio_without_optimizer():
    scenario = TwinScenario(scenario_id="cw4", geo_id="hyderabad", shock=SHOCK, intervention_portfolio=[CHEAP])
    result = compare_worlds(scenario)
    assert result.world_b_label == "intervention"


# --- spatial linkage --------------------------------------------------------------


def test_scenario_by_mandal_inherits_parent_district():
    from backend.geoai.spatial_layer import get_registry

    registry = get_registry()
    hyderabad_mandal_id = registry.mandals.gdf[registry.mandals.gdf["district_id"] == "hyderabad"]["mandal_id"].iloc[0]
    result = run_twin_scenario(TwinScenario(scenario_id="mandal", geo_id=hyderabad_mandal_id))
    assert result.geo_level == "mandal"
    district_result = run_twin_scenario(TwinScenario(scenario_id="district", geo_id="hyderabad"))
    assert result.baseline_state.resilience_score == district_result.baseline_state.resilience_score


def test_unknown_geo_id_raises_keyerror():
    with pytest.raises(KeyError):
        run_twin_scenario(TwinScenario(scenario_id="bad_geo", geo_id="not_a_real_place"))


def test_affected_geographies_includes_shock_target():
    result = run_twin_scenario(TwinScenario(scenario_id="ag", geo_id="hyderabad", shock=SHOCK))
    assert "hyderabad" in result.affected_geographies


# --- truth-status propagation ------------------------------------------------------


def test_twin_result_truth_status_is_simulated():
    result = run_twin_scenario(TwinScenario(scenario_id="ts", geo_id="hyderabad", shock=SHOCK))
    assert result.truth_status == "SIMULATED"
    assert result.baseline_state.truth_status == "ESTIMATED"
    assert result.shocked_state.truth_status == "SIMULATED"


def test_recovery_trajectory_truth_status_is_simulated():
    result = run_twin_scenario(TwinScenario(scenario_id="ts2", geo_id="hyderabad", shock=SHOCK))
    assert result.shock_recovery.truth_status == "SIMULATED"


# --- provenance propagation ---------------------------------------------------------


def test_provenance_refs_include_all_upstream_layers():
    result = run_twin_scenario(TwinScenario(scenario_id="prov", geo_id="hyderabad", shock=SHOCK))
    joined = " ".join(result.provenance_refs)
    assert "intervention" in joined and "graph" in joined and "resilience" in joined and "risk" in joined


def test_twin_provenance_endpoint():
    resp = client.get("/twin/provenance")
    assert resp.status_code == 200
    body = resp.json()
    assert "recovery_model" in body
    assert "assumption_disclosure" in body


# --- uncertainty/assumption propagation ----------------------------------------------


def test_recovery_rate_assumption_disclosed_in_limitations():
    result = run_twin_scenario(TwinScenario(scenario_id="unc", geo_id="hyderabad", shock=SHOCK))
    assert any("recovery_rate" in lim for lim in result.shock_recovery.limitations)


def test_upstream_shock_limitations_propagate_into_twin_result():
    result = run_twin_scenario(TwinScenario(scenario_id="unc2", geo_id="hyderabad", shock=SHOCK, heat_change_c=2.0))
    assert any("COUNTERFACTUAL" in lim or "counterfactual" in lim.lower() for lim in result.limitations)


# --- invalid scenario handling ------------------------------------------------------


def test_unknown_shock_target_node_404s_via_engine():
    with pytest.raises(KeyError):
        run_twin_scenario(
            TwinScenario(scenario_id="bad_shock", geo_id="hyderabad", shock=ShockInput(target_node_id="not_a_real_node", shock_type="production_reduction", severity=0.5))
        )


def test_run_endpoint_404_for_unknown_geo():
    resp = client.post("/twin/run", json={"scenario_id": "x", "geo_id": "not_a_real_place"})
    assert resp.status_code == 404


def test_run_endpoint_400_for_state_level_shock():
    resp = client.post(
        "/twin/run",
        json={"scenario_id": "x", "geo_id": "telangana", "shock": SHOCK.model_dump()},
    )
    assert resp.status_code == 400


def test_scenarios_and_config_endpoints():
    resp = client.get("/twin/scenarios")
    assert resp.status_code == 200
    assert set(resp.json()["scenario_types"].keys()) == {"A_baseline", "B_shock_no_intervention", "C_shock_optimized_intervention", "D_shock_alternative_intervention"}

    resp2 = client.get("/twin/config")
    assert resp2.status_code == 200
    assert "recovery_model" in resp2.json()
