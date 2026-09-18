"""Computes a single intervention's modeled effect against a graph shock,
by re-running the SAME propagation engine (backend/graph/propagation.py)
with severity reduced by the intervention's effectiveness. Nothing here
claims real-world causal effectiveness, cost, capacity improvement, or
recovery time -- see InterventionResult.limitations.
"""
from __future__ import annotations

from backend.graph.contracts import ShockInput
from backend.graph.graph_builder import get_food_graph
from backend.graph.propagation import propagate_shock
from backend.intervention.catalog import get_intervention_type, resolve_effectiveness
from backend.intervention.contracts import InterventionInput, InterventionResult, ModeledChange
from backend.intervention.utils import degrade_resilience_by_impact, impact_at_node
from backend.resilience.model import compute_resilience


def compute_intervention_effect(inp: InterventionInput) -> InterventionResult:
    food_graph = get_food_graph()
    if inp.shock.target_node_id not in food_graph.graph.nodes:
        raise KeyError(f"target_node_id '{inp.shock.target_node_id}' is not a known node in the food graph")

    target_data = food_graph.node(inp.shock.target_node_id)
    geo_id = target_data["geo_id"]
    food_categories = target_data["food_categories"]

    effectiveness, source, label, mechanism = resolve_effectiveness(inp.intervention_type, inp.effectiveness_override)

    limitations = [
        f"effectiveness={effectiveness} is an {'ESTIMATED illustrative default (config/interventions.yaml)' if source == 'config_default' else 'ESTIMATED user-supplied override'}, "
        "not a measured or field-validated intervention effectiveness figure.",
        "Does not claim real-world causal effectiveness, real intervention cost, real capacity improvement, "
        "or real recovery time -- this is a deterministic scenario/intervention engine over the modeled graph, "
        "not field-validated performance.",
        "cost_estimate/water_impact_m3/carbon_impact_tco2e are echoed directly from caller-supplied input "
        "(when provided), never invented by this system -- see cost_note/assumption_note for their source.",
    ]

    catalog_entry = get_intervention_type(inp.intervention_type)
    if catalog_entry is not None and inp.shock.shock_type not in catalog_entry["applicable_shock_types"]:
        limitations.append(
            f"Intervention type '{inp.intervention_type}' is not listed in config/interventions.yaml as "
            f"applicable to shock_type '{inp.shock.shock_type}' (applicable: {catalog_entry['applicable_shock_types']}); "
            "computed anyway since effectiveness was resolved, but treat this pairing with extra caution."
        )

    baseline_resilience = compute_resilience(geo_id)
    demand_node_id = f"demand_{geo_id}"

    shock_propagation = propagate_shock(food_graph.graph, inp.shock)
    shock_demand_impact = impact_at_node(shock_propagation, demand_node_id)
    shock_resilience = degrade_resilience_by_impact(baseline_resilience, shock_demand_impact)

    reduced_severity = round(inp.shock.severity * (1 - effectiveness), 4)
    intervention_shock = ShockInput(
        target_node_id=inp.shock.target_node_id,
        shock_type=inp.shock.shock_type,
        severity=reduced_severity,
        max_hops=inp.shock.max_hops,
    )
    intervention_propagation = propagate_shock(food_graph.graph, intervention_shock)
    intervention_demand_impact = impact_at_node(intervention_propagation, demand_node_id)
    intervention_resilience = degrade_resilience_by_impact(baseline_resilience, intervention_demand_impact)

    target_impact_reduction = round(
        impact_at_node(shock_propagation, inp.shock.target_node_id)
        - impact_at_node(intervention_propagation, inp.shock.target_node_id),
        4,
    )
    food_availability_effect_proxy = round(shock_demand_impact - intervention_demand_impact, 4)
    resilience_effect = round(
        intervention_resilience.current_resilience_score - shock_resilience.current_resilience_score, 4
    )

    return InterventionResult(
        intervention_type=inp.intervention_type,
        intervention_label=label,
        mechanism=mechanism,
        affected_geo_id=geo_id,
        affected_food_categories=food_categories,
        effectiveness_used=effectiveness,
        effectiveness_source=source,
        baseline_resilience=baseline_resilience,
        shock_propagation=shock_propagation,
        shock_resilience=shock_resilience,
        intervention_propagation=intervention_propagation,
        intervention_resilience=intervention_resilience,
        modeled_change=ModeledChange(
            target_node_impact_reduction=target_impact_reduction,
            food_availability_effect_proxy=food_availability_effect_proxy,
            resilience_effect=resilience_effect,
            note=(
                "food_availability_effect_proxy is the reduction in modeled impact_fraction at this "
                "geography's demand node between the shock and intervention propagation runs -- a proxy "
                "for relative service protection, not a measured food-availability quantity."
            ),
        ),
        food_loss_effect=inp.loss_reduction_pct,
        water_impact_m3=inp.water_impact_m3,
        carbon_impact_tco2e=inp.carbon_impact_tco2e,
        cost_estimate=inp.cost_estimate,
        provenance_refs=["backend/graph food network graph", "backend/resilience proxy", "config/interventions.yaml"],
        limitations=limitations,
    )
