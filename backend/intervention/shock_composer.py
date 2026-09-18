"""Translates a structured ShockComposerInput into calls against the
EXISTING risk and graph engines (unmodified):
  - heat_change_c / rainfall_change_pct -> a COUNTERFACTUAL recompute of the
    same deterministic risk formula (backend/risk/baseline_model.py) with
    adjusted observed feature values.
  - transport/storage/production/market fields -> SIMULATED graph
    propagation (backend/graph/propagation.py) targeting the corresponding
    node.
These are user-defined scenario inputs, never presented as observed events.
"""
from __future__ import annotations

import copy

from backend.graph.contracts import ShockInput
from backend.graph.graph_builder import get_food_graph
from backend.graph.propagation import propagate_shock
from backend.intervention.contracts import ShockComposerInput, ShockResult
from backend.intervention.utils import degrade_resilience_by_impact, impact_at_node
from backend.resilience.model import compute_resilience, resolve_district_id
from backend.risk.baseline_model import compute_risk_for_district
from backend.risk.contracts import RiskInput
from backend.risk.features import get_district_feature_row

GRAPH_SHOCK_FIELD_MAP = {
    "production_disruption": ("production_{geo}", "production_reduction"),
    "storage_capacity_reduction": ("storage_{geo}", "storage_capacity_reduction"),
    "transport_capacity_reduction": ("market_{geo}", "transport_capacity_reduction"),
    "market_demand_disruption": ("demand_{geo}", "market_disruption"),
}


def build_shock_result(inp: ShockComposerInput) -> ShockResult:
    district_id, geo_level, resolved_via = resolve_district_id(inp.geo_id)

    limitations = [
        "This is a user-defined/scenario shock, not an observed real-world event -- results are labeled "
        "COUNTERFACTUAL (risk recompute) and SIMULATED (graph propagation) accordingly.",
    ]
    provenance_refs = ["backend/risk climate-stress baseline", "backend/graph food network graph", "backend/resilience proxy"]

    # --- climate counterfactual (reuses backend.risk.baseline_model, unmodified) ---
    baseline_risk = None
    shocked_risk = None
    if inp.heat_change_c is not None or inp.rainfall_change_pct is not None:
        feature_row = get_district_feature_row(district_id)
        if feature_row is None:
            raise LookupError(f"No climate feature row for district '{district_id}' -- run scripts/build_climate_features.py")

        risk_input = RiskInput(geo_id=inp.geo_id, food_category=inp.food_category)
        baseline_risk = compute_risk_for_district(risk_input, feature_row, geo_level=geo_level, resolved_via=resolved_via)

        shocked_row = copy.deepcopy(feature_row)
        if inp.heat_change_c is not None:
            shocked_row["observed"]["t2m_mean_c"] += inp.heat_change_c
        if inp.rainfall_change_pct is not None:
            shocked_row["observed"]["precip_mean_mm_day"] *= (1 + inp.rainfall_change_pct)
        shocked_risk = compute_risk_for_district(risk_input, shocked_row, geo_level=geo_level, resolved_via=resolved_via)
        shocked_risk.truth_status = "COUNTERFACTUAL"
        shocked_risk.limitations.append(
            f"COUNTERFACTUAL: recomputed with a user-specified heat_change_c={inp.heat_change_c}, "
            f"rainfall_change_pct={inp.rainfall_change_pct} applied to observed values -- not a real forecast."
        )

    # --- graph propagation (reuses backend.graph.propagation, unmodified) ---
    food_graph = get_food_graph()
    graph_propagations = []
    for field_name, (node_template, shock_type) in GRAPH_SHOCK_FIELD_MAP.items():
        severity = getattr(inp, field_name)
        if severity is None:
            continue
        target_node_id = node_template.format(geo=district_id)
        shock = ShockInput(target_node_id=target_node_id, shock_type=shock_type, severity=severity, max_hops=inp.max_hops)
        graph_propagations.append(propagate_shock(food_graph.graph, shock))

    # --- resilience: baseline vs shock-adjusted (degraded by demand-node impact + counterfactual risk) ---
    baseline_resilience = compute_resilience(inp.geo_id, inp.food_category)

    shocked_risk_score = shocked_risk.risk_score if shocked_risk is not None else None
    demand_node_id = f"demand_{district_id}"
    max_demand_impact = max((impact_at_node(p, demand_node_id) for p in graph_propagations), default=0.0)
    shocked_resilience = compute_resilience(inp.geo_id, inp.food_category, risk_score_override=shocked_risk_score)
    shocked_resilience = degrade_resilience_by_impact(shocked_resilience, max_demand_impact)

    return ShockResult(
        shock_input=inp,
        geo_id=inp.geo_id,
        food_category=inp.food_category,
        baseline_risk=baseline_risk,
        shocked_risk=shocked_risk,
        baseline_resilience=baseline_resilience,
        shocked_resilience=shocked_resilience,
        graph_propagations=graph_propagations,
        provenance_refs=provenance_refs,
        limitations=limitations,
    )
