"""Digital Twin scenario engine. Composes, without modifying:
  - backend.intervention.shock_composer.build_shock_result (climate + graph shock)
  - backend.intervention.portfolio.compute_portfolio (fixed/manual portfolio)
  - backend.optimization.optimizer.run_optimization (candidate pool -> selection)
  - backend.resilience.model (resilience proxy)
  - backend.risk.baseline_model (climate risk baseline)
  - backend.twin.recovery (new deterministic recovery trajectory)

This is a deterministic scenario/decision-support simulation. It is not a
live operational digital twin, and its recovery trajectory is not a
measured or historically validated real-world forecast.
"""
from __future__ import annotations

from typing import Optional

from backend.geoai.spatial_layer import get_registry
from backend.graph.graph_builder import get_food_graph
from backend.intervention.contracts import InterventionInput, PortfolioInput, ShockComposerInput
from backend.intervention.portfolio import compute_portfolio
from backend.intervention.shock_composer import build_shock_result
from backend.intervention.utils import degrade_resilience_by_impact, impact_at_node
from backend.optimization.contracts import OptimizationInput
from backend.optimization.objectives import extract_objective_values
from backend.optimization.optimizer import run_optimization
from backend.resilience.model import compute_resilience, load_resilience_config
from backend.risk.baseline_model import get_risk
from backend.risk.contracts import RiskInput
from backend.twin.config import load_twin_config
from backend.twin.contracts import RecoveryMetrics, RecoveryTrajectory, ScenarioState, TwinResult, TwinScenario
from backend.twin.recovery import compute_recovery_metrics, simulate_recovery

SHOCK_TYPE_TO_COMPOSER_FIELD = {
    "production_reduction": "production_disruption",
    "storage_capacity_reduction": "storage_capacity_reduction",
    "transport_capacity_reduction": "transport_capacity_reduction",
    "market_disruption": "market_demand_disruption",
}

TWIN_LIMITATIONS = [
    "This is a deterministic scenario/decision-support simulation, not a live operational digital twin, and "
    "its recovery trajectory is not a measured or historically validated real-world forecast.",
    "Graph-based interventions (production/storage/transport/market) do not modify climate risk in this "
    "model; only heat_change_c/rainfall_change_pct scenarios do, via a COUNTERFACTUAL risk recompute.",
]


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _state_level_baseline(food_category: str) -> tuple[Optional[float], float, float]:
    """Unweighted mean risk/resilience across all districts -- the same
    aggregation style as GET /risk/state, reused here as a simple average
    for the special geo_id 'telangana' (baseline-only; shocks require a
    specific district/mandal target node)."""
    registry = get_registry()
    district_ids = sorted(registry.districts.gdf["district_id"])
    risk_scores = []
    resilience_scores = []
    gaps = []
    for did in district_ids:
        r = get_risk(RiskInput(geo_id=did, food_category=food_category))
        if r.risk_score is not None:
            risk_scores.append(r.risk_score)
        res = compute_resilience(did, food_category)
        resilience_scores.append(res.current_resilience_score)
        gaps.append(res.resilience_gap)
    mean_risk = round(sum(risk_scores) / len(risk_scores), 4) if risk_scores else None
    mean_resilience = round(sum(resilience_scores) / len(resilience_scores), 4)
    mean_gap = round(sum(gaps) / len(gaps), 4)
    return mean_risk, mean_resilience, mean_gap


def run_twin_scenario(scenario: TwinScenario) -> TwinResult:
    twin_config = load_twin_config()["recovery_model"]
    resilience_config = load_resilience_config()["resilience_model"]
    target_resilience_score = resilience_config["target_resilience_score"]

    horizon_days = scenario.simulation_horizon_days or twin_config["default_horizon_days"]
    recovery_rate = scenario.recovery_rate_override if scenario.recovery_rate_override is not None else twin_config["recovery_rate"]
    recovery_rate_source = "user_override" if scenario.recovery_rate_override is not None else "config_default"
    timestep_days = twin_config["timestep_days"]
    recovery_threshold = twin_config["recovery_threshold"]

    limitations = list(TWIN_LIMITATIONS)
    provenance_refs = [
        "backend/intervention shock composer + portfolio engine",
        "backend/optimization portfolio optimizer",
        "backend/graph food network graph",
        "backend/resilience proxy",
        "backend/risk climate-stress baseline",
        "config/twin.yaml",
    ]

    registry = get_registry()
    is_state_level = scenario.geo_id == "telangana"
    if not is_state_level and registry.districts.get(scenario.geo_id) is None and registry.mandals.get(scenario.geo_id) is None:
        raise KeyError(f"geo_id '{scenario.geo_id}' is not a known district_id, mandal_id, or 'telangana'.")
    geo_level = "state" if is_state_level else ("district" if registry.districts.get(scenario.geo_id) else "mandal")

    has_shock = scenario.shock is not None
    has_climate_shock = scenario.heat_change_c is not None or scenario.rainfall_change_pct is not None

    if is_state_level and (has_shock or has_climate_shock):
        raise ValueError(
            "State-level ('telangana') shock scenarios are not supported this sprint -- the food graph has no "
            "distinct state-level node. Specify a district or mandal geo_id/shock target instead."
        )

    # --- Scenario A: pure baseline, no shock at all ---
    if not has_shock and not has_climate_shock:
        if is_state_level:
            mean_risk, mean_resilience, mean_gap = _state_level_baseline(scenario.food_category)
            baseline_state = ScenarioState(
                label="baseline",
                risk_score=mean_risk,
                risk_truth_status="ESTIMATED" if mean_risk is not None else None,
                resilience_score=mean_resilience,
                resilience_gap=mean_gap,
                demand_impact_fraction=0.0,
                truth_status="ESTIMATED",
            )
            limitations.append(
                "geo_id='telangana' baseline is an unweighted mean of risk/resilience across all 33 "
                "districts (same style as GET /risk/state), not a population- or production-weighted figure."
            )
        else:
            risk_result = get_risk(RiskInput(geo_id=scenario.geo_id, food_category=scenario.food_category))
            resilience_result = compute_resilience(scenario.geo_id, scenario.food_category)
            baseline_state = ScenarioState(
                label="baseline",
                risk_score=risk_result.risk_score,
                risk_truth_status=risk_result.truth_status,
                resilience_score=resilience_result.current_resilience_score,
                resilience_gap=resilience_result.resilience_gap,
                demand_impact_fraction=0.0,
                truth_status="ESTIMATED",
            )
        return TwinResult(
            scenario_id=scenario.scenario_id,
            geo_id=scenario.geo_id,
            geo_level=geo_level,
            food_category=scenario.food_category,
            baseline_state=baseline_state,
            affected_geographies=[scenario.geo_id],
            affected_food_categories=[scenario.food_category],
            provenance_refs=provenance_refs,
            limitations=_dedupe(limitations),
        )

    # --- Scenarios B/C/D: shock (and optionally intervention/optimization) ---
    food_graph = get_food_graph()
    if scenario.shock is not None and scenario.shock.target_node_id not in food_graph.graph.nodes:
        raise KeyError(f"shock.target_node_id '{scenario.shock.target_node_id}' is not a known node in the food graph")

    if scenario.shock is not None:
        target_geo_id = food_graph.node(scenario.shock.target_node_id)["geo_id"]
        composer_field = SHOCK_TYPE_TO_COMPOSER_FIELD[scenario.shock.shock_type]
        composer_kwargs = {
            "geo_id": target_geo_id,
            "food_category": scenario.food_category,
            "heat_change_c": scenario.heat_change_c,
            "rainfall_change_pct": scenario.rainfall_change_pct,
            "max_hops": scenario.shock.max_hops,
            composer_field: scenario.shock.severity,
        }
    else:
        # Pure climate shock, no graph target -- pick the geo itself as the reference point.
        target_geo_id = scenario.geo_id
        composer_kwargs = {
            "geo_id": target_geo_id,
            "food_category": scenario.food_category,
            "heat_change_c": scenario.heat_change_c,
            "rainfall_change_pct": scenario.rainfall_change_pct,
        }

    shock_result = build_shock_result(ShockComposerInput(**composer_kwargs))
    if target_geo_id != scenario.geo_id:
        limitations.append(
            f"scenario.geo_id ('{scenario.geo_id}') differs from the shock target's geography "
            f"('{target_geo_id}'); state/risk/resilience reporting uses the shock target's geography."
        )

    baseline_risk_result = get_risk(RiskInput(geo_id=target_geo_id, food_category=scenario.food_category))
    baseline_resilience = shock_result.baseline_resilience
    shocked_resilience = shock_result.shocked_resilience

    demand_node_id = f"demand_{target_geo_id}"
    demand_impact_shock = (
        impact_at_node(shock_result.graph_propagations[0], demand_node_id) if shock_result.graph_propagations else 0.0
    )

    baseline_state = ScenarioState(
        label="baseline",
        risk_score=baseline_risk_result.risk_score,
        risk_truth_status=baseline_risk_result.truth_status,
        resilience_score=baseline_resilience.current_resilience_score,
        resilience_gap=baseline_resilience.resilience_gap,
        demand_impact_fraction=0.0,
        truth_status="ESTIMATED",
    )

    shocked_risk_score = shock_result.shocked_risk.risk_score if shock_result.shocked_risk else baseline_risk_result.risk_score
    shocked_risk_truth = shock_result.shocked_risk.truth_status if shock_result.shocked_risk else baseline_risk_result.truth_status
    shocked_state = ScenarioState(
        label="shock_no_intervention",
        risk_score=shocked_risk_score,
        risk_truth_status=shocked_risk_truth,
        resilience_score=shocked_resilience.current_resilience_score,
        resilience_gap=shocked_resilience.resilience_gap,
        demand_impact_fraction=round(demand_impact_shock, 4),
        truth_status="SIMULATED",
    )
    limitations.extend(shock_result.limitations)

    affected_food_categories = set([scenario.food_category])
    if scenario.shock is not None:
        affected_food_categories.update(food_graph.node(scenario.shock.target_node_id).get("food_categories", []))

    intervention_state: Optional[ScenarioState] = None
    intervention_recovery: Optional[RecoveryTrajectory] = None
    intervention_recovery_metrics: Optional[RecoveryMetrics] = None

    if scenario.intervention_portfolio:
        if scenario.shock is None:
            raise ValueError("intervention_portfolio requires a graph `shock` (climate-only scenarios cannot be countered by graph interventions in this model).")
        intervention_inputs = [
            InterventionInput(shock=scenario.shock, **c.model_dump()) for c in scenario.intervention_portfolio
        ]
        portfolio_result = compute_portfolio(PortfolioInput(interventions=intervention_inputs, constraints=scenario.constraints))
        ov = extract_objective_values(portfolio_result)
        intervention_demand_impact = round(demand_impact_shock - (ov.food_availability_effect_proxy or 0.0), 4)
        intervention_resilience = degrade_resilience_by_impact(baseline_resilience, intervention_demand_impact)
        intervention_state = ScenarioState(
            label="intervention",
            risk_score=shocked_state.risk_score,
            risk_truth_status=shocked_state.risk_truth_status,
            resilience_score=intervention_resilience.current_resilience_score,
            resilience_gap=intervention_resilience.resilience_gap,
            demand_impact_fraction=intervention_demand_impact,
            food_availability_effect_proxy=ov.food_availability_effect_proxy,
            food_loss_effect=ov.food_loss_effect,
            cost=ov.cost,
            water_impact_m3=ov.water_impact_m3,
            carbon_impact_tco2e=ov.carbon_impact_tco2e,
            intervention_types=[c.intervention_type for c in scenario.intervention_portfolio],
            truth_status="SIMULATED",
        )
        limitations.extend(portfolio_result.limitations)

    optimized_state: Optional[ScenarioState] = None
    optimized_recovery: Optional[RecoveryTrajectory] = None
    optimized_recovery_metrics: Optional[RecoveryMetrics] = None

    if scenario.optimize_candidates:
        if scenario.shock is None:
            raise ValueError("optimize_candidates requires a graph `shock` (climate-only scenarios cannot be countered by graph interventions in this model).")
        optimization_result = run_optimization(
            OptimizationInput(
                shock=scenario.shock,
                candidate_interventions=scenario.optimize_candidates,
                constraints=scenario.constraints,
                objective_weights=scenario.objective_weights,
            )
        )
        limitations.extend(optimization_result.limitations)
        if optimization_result.selected_candidate is not None:
            selected = optimization_result.selected_candidate
            ov = selected.objective_values
            optimized_demand_impact = round(demand_impact_shock - (ov.food_availability_effect_proxy or 0.0), 4)
            optimized_resilience = degrade_resilience_by_impact(baseline_resilience, optimized_demand_impact)
            optimized_state = ScenarioState(
                label="optimized_intervention",
                risk_score=shocked_state.risk_score,
                risk_truth_status=shocked_state.risk_truth_status,
                resilience_score=optimized_resilience.current_resilience_score,
                resilience_gap=optimized_resilience.resilience_gap,
                demand_impact_fraction=optimized_demand_impact,
                food_availability_effect_proxy=ov.food_availability_effect_proxy,
                food_loss_effect=ov.food_loss_effect,
                cost=ov.cost,
                water_impact_m3=ov.water_impact_m3,
                carbon_impact_tco2e=ov.carbon_impact_tco2e,
                intervention_types=selected.intervention_types,
                truth_status="SIMULATED",
            )
        else:
            limitations.append("optimize_candidates was supplied but the optimizer found no feasible portfolio under the given constraints; optimized_state is unavailable.")

    # --- recovery trajectories ---
    shock_recovery = simulate_recovery(
        starting_label="shock_no_intervention",
        initial_impact=demand_impact_shock,
        initial_resilience=shocked_resilience.current_resilience_score,
        pre_shock_resilience=baseline_resilience.current_resilience_score,
        target_resilience_score=target_resilience_score,
        horizon_days=horizon_days,
        recovery_rate=recovery_rate,
        recovery_rate_source=recovery_rate_source,
        timestep_days=timestep_days,
    )
    shock_recovery_metrics = compute_recovery_metrics(shock_recovery, recovery_threshold)

    if intervention_state is not None:
        intervention_recovery = simulate_recovery(
            starting_label="intervention",
            initial_impact=intervention_state.demand_impact_fraction,
            initial_resilience=intervention_state.resilience_score,
            pre_shock_resilience=baseline_resilience.current_resilience_score,
            target_resilience_score=target_resilience_score,
            horizon_days=horizon_days,
            recovery_rate=recovery_rate,
            recovery_rate_source=recovery_rate_source,
            timestep_days=timestep_days,
        )
        intervention_recovery_metrics = compute_recovery_metrics(intervention_recovery, recovery_threshold)

    if optimized_state is not None:
        optimized_recovery = simulate_recovery(
            starting_label="optimized_intervention",
            initial_impact=optimized_state.demand_impact_fraction,
            initial_resilience=optimized_state.resilience_score,
            pre_shock_resilience=baseline_resilience.current_resilience_score,
            target_resilience_score=target_resilience_score,
            horizon_days=horizon_days,
            recovery_rate=recovery_rate,
            recovery_rate_source=recovery_rate_source,
            timestep_days=timestep_days,
        )
        optimized_recovery_metrics = compute_recovery_metrics(optimized_recovery, recovery_threshold)

    return TwinResult(
        scenario_id=scenario.scenario_id,
        geo_id=scenario.geo_id,
        geo_level=geo_level,
        food_category=scenario.food_category,
        baseline_state=baseline_state,
        shocked_state=shocked_state,
        intervention_state=intervention_state,
        optimized_state=optimized_state,
        shock_recovery=shock_recovery,
        intervention_recovery=intervention_recovery,
        optimized_recovery=optimized_recovery,
        shock_recovery_metrics=shock_recovery_metrics,
        intervention_recovery_metrics=intervention_recovery_metrics,
        optimized_recovery_metrics=optimized_recovery_metrics,
        affected_geographies=sorted({target_geo_id, scenario.geo_id}),
        affected_food_categories=sorted(affected_food_categories),
        provenance_refs=provenance_refs,
        limitations=_dedupe(limitations),
    )
